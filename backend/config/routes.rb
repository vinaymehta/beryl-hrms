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
        post "forgot_password", to: "passwords#create"
        post "reset_password", to: "passwords#update"
        patch "change_password", to: "password_changes#update"
      end

      get "dashboard/summary", to: "dashboard#summary"

      resources :employees, only: %i[ index show create update ] do
        member { patch :deactivate }
      end
      resources :departments, only: %i[ index show create update destroy ]
      resources :designations, only: %i[ index show create update destroy ]

      resources :leaves, only: %i[ index create update ]

      get "attendance", to: "attendance#index"
      get "attendance/today", to: "attendance#today"
      post "attendance/check_in", to: "attendance#check_in"
      patch "attendance/check_out", to: "attendance#check_out"

      resources :documents, only: %i[ index create destroy ] do
        member { get :download }
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
    end
  end
end
