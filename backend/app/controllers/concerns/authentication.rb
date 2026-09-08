# Adapted from Rails 8's generated authentication concern for a pure JSON
# API: unauthenticated requests get a 401 JSON body instead of a redirect
# (there is no HTML session/new page to redirect to — the frontend is a
# separate app), and the session lookup treats an expired Session row as
# absent rather than valid.
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private
    def authenticated?
      resume_session.present?
    end

    def require_authentication
      resume_session || render_unauthenticated
    end

    def resume_session
      Current.session ||= find_session_by_cookie
    end

    def find_session_by_cookie
      return nil unless cookies.signed[:session_id]

      session = Session.find_by(id: cookies.signed[:session_id])
      session unless session.nil? || session.expired?
    end

    def render_unauthenticated
      render json: { errors: [ { code: "unauthenticated", message: "Authentication required." } ] },
             status: :unauthorized
    end

    def start_new_session_for(user)
      user.sessions.create!(user_agent: request.user_agent, ip_address: request.remote_ip).tap do |session|
        Current.session = session
        cookies.signed.permanent[:session_id] = {
          value: session.id,
          httponly: true,
          same_site: :lax,
          secure: Rails.env.production?
        }
        rotate_csrf_token
      end
    end

    def terminate_session
      Current.session&.destroy
      cookies.delete(:session_id)
      cookies.delete(:csrf_token)
    end
end
