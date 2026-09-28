module ApplicationCable
  # Authenticated by the same signed session cookie the API uses, with the same
  # rule: an expired session is no session. Rejected otherwise, so an anonymous
  # socket never reaches a channel.
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      set_current_user || reject_unauthorized_connection
    end

    private
      def set_current_user
        session = Session.find_by(id: cookies.signed[:session_id])
        return nil if session.nil? || session.expired?

        # without_tenant: User is tenant-scoped and there is no request tenant
        # on a socket — the same reason Authentication resolves it this way.
        self.current_user = ActsAsTenant.without_tenant { session.user }
      end
  end
end
