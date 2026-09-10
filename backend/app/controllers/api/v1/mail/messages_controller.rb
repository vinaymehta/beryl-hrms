module Api
  module V1
    module Mail
      class MessagesController < Api::V1::Mail::BaseController
        FOLDERS = %w[inbox sent drafts trash spam].freeze

        # GET /api/v1/mail/messages?connectionId=...&folder=inbox&folderId=...&page=1
        def index
          connection = resolve_connection!
          return unless connection

          folder = params[:folder].presence || "inbox"
          folder_id = params[:folderId].presence
          page = params[:page].to_i.clamp(1, Float::INFINITY).to_i.nonzero? || 1

          body = zoho_client.list_messages(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            folder: folder,
            folder_id: folder_id,
            page: page
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
              folder: folder,
              folderId: folder_id
            }
          }
        end

        # GET /api/v1/mail/messages/:id?connectionId=...&folderId=...&from=...&to=...&subject=...
        def show
          connection = resolve_connection!
          return unless connection

          raw = zoho_client.get_message(
            access_token: connection.access_token, account_id: account_id_for(connection),
            message_id: params[:id], folder_id: params[:folderId].presence
          )
          detail = ::Zoho::MessagePresenter.detail(raw)

          # get_message's own header lookup (see its comment) resorts to a
          # cross-folder "mid:" search when it isn't given a folder_id, and
          # that search has been observed returning a DIFFERENT message's
          # headers entirely — silently mislabeling who a message is from
          # and, worse, sending replies to the wrong address. The frontend
          # already has verified-correct from/to/subject for this exact
          # message from the folder list it was just clicked from, so prefer
          # that over whatever get_message guessed.
          detail[:from] = params[:from].presence || detail[:from]
          detail[:to] = params[:to].presence || detail[:to]
          detail[:subject] = params[:subject].presence || detail[:subject]

          render_data(detail)
        end

        # POST /api/v1/mail/messages?connectionId=...
        def create
          connection = resolve_connection!
          return unless connection

          from_address = params[:from_address].presence || connection.email_address
          result = zoho_client.send_message(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            from_address: from_address,
            to_address: params[:to_address],
            subject: params[:subject],
            content: params[:content] || params[:body],
            cc_address: params[:cc_address],
            bcc_address: params[:bcc_address]
          )

          Rails.cache.delete("zoho_mail_stats_#{account_id_for(connection)}")
          render_data(result, status: :created)
        end

        # PATCH /api/v1/mail/messages/:id/read?connectionId=...
        def mark_read
          connection = resolve_connection!
          return unless connection

          read = params[:read].nil? ? true : ActiveModel::Type::Boolean.new.cast(params[:read])
          zoho_client.mark_as_read(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            message_id: params[:id],
            read: read
          )

          Rails.cache.delete("zoho_mail_stats_#{account_id_for(connection)}")
          render_data({ id: params[:id], isRead: read })
        end

        # DELETE /api/v1/mail/messages/:id?connectionId=...
        def destroy
          connection = resolve_connection!
          return unless connection

          zoho_client.delete_message(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            message_id: params[:id],
            folder_id: params[:folderId]
          )

          Rails.cache.delete("zoho_mail_stats_#{account_id_for(connection)}")
          head :no_content
        end

        # GET /api/v1/mail/messages/:id/attachments/:attachment_id?connectionId=...
        def attachment
          connection = resolve_connection!
          return unless connection

          file_data = zoho_client.download_attachment(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            message_id: params[:id],
            attachment_id: params[:attachment_id]
          )

          send_data file_data[:body],
                    filename: file_data[:filename] || "attachment",
                    type: file_data[:content_type] || "application/octet-stream",
                    disposition: "attachment"
        end
      end
    end
  end
end
