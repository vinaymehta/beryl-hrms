require "sidekiq/web"
require "sidekiq/cron/web"

Rails.application.routes.draw do
  mount Rswag::Ui::Engine => "/api-docs"
  mount Rswag::Api::Engine => "/api-docs"
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Sidekiq::Web is a Rack app outside the normal controller/Pundit flow, so
  # access is gated with a route constraint reading the same signed session
  # cookie the API uses, restricted to the Admin role specifically (an ops
  # tool, not a business-permission-gated feature).
  authenticated_admin = lambda do |request|
    session = Session.find_by(id: request.cookie_jar.signed[:session_id])
    session.present? && !session.expired? && session.user.roles.exists?(slug: "admin")
  end
  constraints(authenticated_admin) do
    mount Sidekiq::Web => "/sidekiq"
  end

  namespace :api do
    namespace :v1 do
      namespace :auth do
        post "register", to: "registrations#create"
        post "login", to: "sessions#create"
        delete "logout", to: "sessions#destroy_current"
        resources :sessions, only: %i[ index destroy ]
        get "me", to: "me#show"
        post "verify_email", to: "email_verifications#create"
        # The first-login flow for an Admin-invited employee. Unauthenticated
        # by necessity — see Api::V1::Auth::InvitationsController.
        post "forgot_password", to: "passwords#create"
        post "reset_password", to: "passwords#update"
        patch "change_password", to: "password_changes#update"
      end

      # Public, unauthenticated: the INTERVIEWER's write-up of a candidate.
      # Addressed by unguessable token, never by candidate id, and needs no
      # login by design — see Api::V1::FeedbackController.
      get "feedback/:token", to: "feedback#show", as: :candidate_feedback
      post "feedback/:token", to: "feedback#create"

      get "dashboard/summary", to: "dashboard#summary"

      resources :employees, only: %i[ index show create update ] do
        # The code to prefill the add-employee form with. A suggestion, not a
        # reservation — see Employees::NextCode.
        collection { get :next_code }
        member do
          patch :deactivate
          # Account access, kept apart from the profile edit above. Neither
          # sets a password: both send the employee a link and return only
          # the address it went to.
          post :invite
          post :reset_password
        end

        # Phase 1 profile history + Phase 5 continuous performance. All nested
        # under the employee they describe, and all served by the shared
        # EmployeeSubresource concern.
        resources :employment_events, only: %i[ index ],
                  controller: "employee_employment_events"
        resources :compensation_records, only: %i[ index create update destroy ],
                  controller: "employee_compensation_records"
        resources :assets, only: %i[ index create update destroy ],
                  controller: "employee_assets"
        resources :goals, only: %i[ index create update destroy ],
                  controller: "employee_goals"
        resources :skills, only: %i[ index create update destroy ],
                  controller: "employee_skills" do
          member { patch :validate_skill }
        end
        resources :trainings, only: %i[ index create update destroy ],
                  controller: "employee_trainings"
        resources :improvement_plans, only: %i[ index create update destroy ],
                  controller: "performance_improvement_plans"
      end
      # --- Performance Appraisal ------------------------------------------
      resources :appraisal_templates, only: %i[ index show create update destroy ] do
        member do
          post :new_version
          patch :activate
        end
        collection do
          # Parse-and-preview only; nothing is saved until the admin confirms.
          post :import_preview
          get :import_format
        end
      end

      resources :appraisal_cycles, only: %i[ index show create update destroy ] do
        member do
          post :start
          patch :close
          get :calibration
        end
      end

      resources :appraisals, only: %i[ index show ] do
        member do
          # The employee's own V1 — creates the immutable revision.
          post :submit_self
          # Work in progress. Mutable and unversioned, so a step-by-step
          # self-appraisal can save as it goes without minting V-numbers.
          patch :save_draft
          # A reviewer's independent version at the stage they own.
          post :submit_review
          patch :advance
          patch :return_for_correction
          patch :override_score
          patch :release
          patch :acknowledge
          post :add_comment
          # Parse-and-preview only; nothing is saved until the employee submits.
          post :import_preview
          get :export
        end

        # Optional 360° feedback (§21).
        resources :feedback_requests, only: %i[ index create destroy ],
                  controller: "appraisal_feedback_requests" do
          member { patch :respond_to_request }
        end
      end

      resources :notifications, only: %i[ index update ] do
        collection { patch :mark_all_read }
      end

      # Read-only: the audit trail is written by Audit::Record and never
      # edited or deleted through the API.
      resources :audit_logs, only: %i[ index show ] do
        collection { get :actions }
      end

      # Company-wide preferences (the employee-code pattern). Singular: there
      # is one per company, and it is the Company row itself.
      get "company_settings", to: "company_settings#show"
      patch "company_settings", to: "company_settings#update"

      # Read-only list, for the Employee form's role picker — see RolePolicy.
      resources :roles, only: %i[ index ]
      resources :departments, only: %i[ index show create update destroy ]
      resources :designations, only: %i[ index show create update destroy ]

      resources :leaves, only: %i[ index create update ]

      get "attendance", to: "attendance#index"
      get "attendance/today", to: "attendance#today"
      post "attendance/check_in", to: "attendance#check_in"
      patch "attendance/check_out", to: "attendance#check_out"

      resources :documents, only: %i[ index create destroy ] do
        member do
          get :download
          get :preview
        end
      end

      namespace :mail do
        post "connections/company", to: "connections#create_company"
        post "connections/individual", to: "connections#create_individual"
        get "connections/callback", to: "connections#callback"
        get "connections", to: "connections#index"
        delete "connections/:id", to: "connections#destroy"

        get "stats", to: "stats#show"
        get "folders", to: "folders#index"

        get "messages", to: "messages#index"
        post "messages", to: "messages#create"
        get "messages/:id", to: "messages#show"
        patch "messages/:id/read", to: "messages#mark_read"
        delete "messages/:id", to: "messages#destroy"
        get "messages/:id/attachments/:attachment_id", to: "messages#attachment"
        get "search", to: "search#index"
      end

      namespace :calendly do
        # PUBLIC — Calendly posts booking/cancellation events here. Authenticated
        # by HMAC signature only; see Api::V1::Calendly::WebhooksController.
        post "webhooks", to: "webhooks#create"

        post "connections", to: "connections#create"
        get "connections", to: "connections#index"
        # Hit by Calendly redirecting the browser, so it must be declared before
        # the :id route or "callback" would be parsed as an id.
        get "connections/callback", to: "connections#callback"
        get "connections/event_types", to: "connections#event_types"
        patch "connections/event_type", to: "connections#set_event_type"
        post "connections/register_webhook", to: "connections#register_webhook"
        delete "connections/:id", to: "connections#destroy"
      end

      namespace :recruitment do
        get "dashboard/stats", to: "dashboard#stats"
        get "dashboard/analytics", to: "dashboard#analytics"
        get "dashboard/insights", to: "dashboard#insights"

        resources :candidates do
          member do
            patch :shortlist
            patch :reject
            patch :status
            # Assigns the interviewer and sends the Calendly booking link. The
            # candidate picks the slot; they cannot reschedule (the link is
            # single-use), so there is no separate reschedule action.
            patch :schedule_interview
            patch :request_feedback
            patch :confirm_duplicate
            patch :dismiss_duplicate
            # AI-written interview questions. GET reads what is stored; POST
            # (re)generates, which costs a provider call.
            get :interview_questions
            post :interview_questions, action: :generate_interview_questions
          end
        end

        resources :resumes, only: %i[ index show create destroy ] do
          member do
            post :reprocess
            get :download
            get :preview
          end
          collection do
            post :import_from_zoho
            post :scan_zoho_mail
          end
        end

        resources :jobs do
          member do
            post :match_candidates
            patch "matches/:match_id", to: "jobs#update_match"
          end
        end

        post "search/ai", to: "search#ai"
      end
    end
  end
end
