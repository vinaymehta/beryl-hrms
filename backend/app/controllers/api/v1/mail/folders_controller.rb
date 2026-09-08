module Api
  module V1
    module Mail
      class FoldersController < Api::V1::Mail::BaseController
        # GET /api/v1/mail/folders?connectionId=...
        def index
          connection = resolve_connection!
          return unless connection

          folders = zoho_client.fetch_folders(
            access_token: connection.access_token,
            account_id: account_id_for(connection)
          )
          render_data(folders)
        end
      end
    end
  end
end
