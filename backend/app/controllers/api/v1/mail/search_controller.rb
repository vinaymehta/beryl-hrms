module Api
  module V1
    module Mail
      class SearchController < Api::V1::Mail::BaseController
        # GET /api/v1/mail/search?connectionId=...&q=...
        def index
          connection = resolve_connection!
          return unless connection

          authorize connection, :search?

          if params[:q].blank?
            return render json: { errors: [ { code: "missing_query", message: "A search query is required." } ] },
                           status: :unprocessable_content
          end

          page = params[:page].to_i.clamp(1, Float::INFINITY).to_i.nonzero? || 1
          body = zoho_client.search_messages(
            access_token: connection.access_token, account_id: account_id_for(connection),
            query: params[:q], page: page
          )

          raw_messages = Array(body["data"])
          messages = raw_messages.map { |m| ::Zoho::MessagePresenter.summary(m) }

          render json: {
            data: messages,
            meta: {
              page: page,
              perPage: 25,
              totalPages: (raw_messages.length == 25 ? page + 1 : page),
              totalCount: raw_messages.length,
              query: params[:q]
            }
          }
        end
      end
    end
  end
end
