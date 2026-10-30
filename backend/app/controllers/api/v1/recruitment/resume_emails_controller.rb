module Api
  module V1
    module Recruitment
      # The resume panel's Emails tab: one timeline of everything exchanged
      # with this resume's candidate — their conversation in the connected
      # Zoho mailboxes (Recruitment::CandidateMailHistory) and the recruitment
      # mail the app itself sent about them (RecruitmentEmail), which goes out
      # through ActionMailer and so is in no Zoho mailbox.
      #
      # Gated on seeing the resume, not on mail.view: it shows only the mail
      # about this one candidate. Mailboxes are the viewer's policy scope —
      # company mailboxes plus their own personal one, never a colleague's.
      #
      # Extends Mail::BaseController for its Zoho-error-to-HTTP-status mapping
      # on #show; #index reports per-mailbox failures inside its response
      # instead, so one broken mailbox doesn't hide the rest.
      class ResumeEmailsController < Api::V1::Mail::BaseController
        before_action :set_resume

        # GET /api/v1/recruitment/resumes/:resume_id/emails
        def index
          authorize @resume, :show?

          result = mail_history.call
          # Parsed, not string-sorted: the two sources format their offsets
          # differently.
          items = (result.items + app_items).sort_by { |i| -Time.iso8601(i[:date]).to_f }

          render_data({ candidateEmail: candidate_address, accounts: result.accounts, items: items })
        end

        # GET /api/v1/recruitment/resumes/:resume_id/emails/:id?connectionId=...
        # One Zoho message in full, for expanding a timeline entry.
        def show
          authorize @resume, :show?

          connection = policy_scope(ZohoConnection).active.find(params[:connectionId] || params[:connection_id])
          summary = mail_history.find(connection, params[:id])
          return render_not_found unless summary

          mb = mailbox_for(connection)
          raw = zoho_client.get_message(
            access_token: mb.access_token, account_id: mb.account_id,
            message_id: params[:id], folder_id: summary["folderId"].presence
          )
          detail = ::Zoho::MessagePresenter.detail(raw)

          # Headers from the verified search result, not get_message's guess —
          # same reasoning as Api::V1::Mail::MessagesController#show.
          verified = ::Zoho::MessagePresenter.summary(summary)
          detail.merge!(from: verified[:from], to: verified[:to], subject: verified[:subject])
          # The Mail page renders bodies as-is; here the HTML is sanitized
          # server-side first, since this view is open to resume viewers too.
          detail[:body] = Rails::HTML5::SafeListSanitizer.new.sanitize(detail[:body].to_s)

          render_data(detail)
        end

        private
          def set_resume
            @resume = policy_scope(CandidateResume).includes(:candidate).find(params[:resume_id])
          end

          def mail_history
            @mail_history ||= ::Recruitment::CandidateMailHistory.new(
              connections: policy_scope(ZohoConnection).order(:id).to_a,
              address: candidate_address,
              original_email_ids: original_email_ids,
              client: zoho_client
            )
          end

          # The candidate's own address, falling back — while the resume
          # isn't linked to a candidate yet — to the one typed on its careers
          # application, then to what was read off the resume.
          def candidate_address
            @candidate_address ||= begin
              extracted = @resume.extracted_data.is_a?(Hash) ? @resume.extracted_data["email"] : nil
              extracted = extracted["value"] if extracted.is_a?(Hash)
              (@resume.candidate&.email.presence || @resume.job_application&.email || extracted.presence)&.strip&.downcase
            end
          end

          # Every email any of the candidate's resumes arrived in.
          def original_email_ids
            ids = [ @resume.source_email_id ]
            ids += @resume.candidate.candidate_resumes.pluck(:source_email_id) if @resume.candidate
            ids.compact_blank.uniq
          end

          # The candidate's mail, plus any sent about this resume before it
          # had a candidate (an application's confirmation).
          def app_items
            emails = RecruitmentEmail.where(candidate_resume_id: @resume.id)
            emails = emails.or(RecruitmentEmail.where(candidate_id: @resume.candidate_id)) if @resume.candidate_id

            emails.order(sent_at: :desc).map do |e|
              {
                source: "app",
                id: "app-#{e.id}",
                direction: "sent",
                mailer: "#{e.mailer}##{e.mailer_action}",
                from: e.from_address.to_s,
                to: e.to_address.to_s,
                subject: e.subject.presence || "(no subject)",
                date: e.sent_at.iso8601,
                snippet: e.body_text.to_s.squish.truncate(200),
                # Short enough to ship inline — expanding an app item needs no
                # second request.
                body: e.body_text.to_s,
                hasAttachments: e.attachment_names.any?,
                attachmentNames: e.attachment_names,
                isOriginalApplication: false
              }
            end
          end
      end
    end
  end
end
