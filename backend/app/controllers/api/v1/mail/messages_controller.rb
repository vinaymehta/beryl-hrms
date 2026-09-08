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

        # GET /api/v1/mail/messages/:id?connectionId=...
        def show
          connection = resolve_connection!
          return unless connection

          raw = zoho_client.get_message(
            access_token: connection.access_token, account_id: account_id_for(connection), message_id: params[:id]
          )
          render_data(::Zoho::MessagePresenter.detail(raw))
        end

        # POST /api/v1/mail/messages?connectionId=...
        def create
          connection = resolve_connection!
          return unless connection

          from_address = params[:fromAddress].presence || connection.email_address
          result = zoho_client.send_message(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            from_address: from_address,
            to_address: params[:toAddress],
            subject: params[:subject],
            content: params[:content] || params[:body],
            cc_address: params[:ccAddress],
            bcc_address: params[:bccAddress]
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
