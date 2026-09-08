module Api
  module V1
    module Mail
      class StatsController < Api::V1::Mail::BaseController
        # GET /api/v1/mail/stats?connectionId=...
        def show
          connection = resolve_connection!
          return unless connection

          refresh = params[:refresh].to_s == "true"
          stats = zoho_client.fetch_stats(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            refresh: refresh
          )
          render_data(stats)
        end
      end
    end
  end
end
