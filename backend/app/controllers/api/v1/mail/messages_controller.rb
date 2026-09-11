module Api
  module V1
    module Mail
      class MessagesController < Api::V1::Mail::BaseController
        FOLDERS = %w[inbox sent drafts trash spam].freeze

        # GET /api/v1/mail/messages?connectionId=...&folder=inbox&folderId=...&page=1
        # &dateFrom=...&dateTo=... — a live view of the mailbox for exactly
        # that range, fetched from Zoho on the spot. Picking a range never
        # stores anything and never touches ZohoAutoScanJob's own cursor,
        # which keeps processing only newly received mail independently.
        def index
          connection = resolve_connection!
          return unless connection

          folder = params[:folder].presence || "inbox"
          folder_id = params[:folderId].presence
          page = params[:page].to_i.clamp(1, Float::INFINITY).to_i.nonzero? || 1
          # The Mail page's date filter is the single source of truth for
          # which history is fetched — nothing is stored per connection and
          # there is no fallback range anywhere else.
          date_from = parse_filter_date(params[:dateFrom])
          date_to = parse_filter_date(params[:dateTo])

          if date_from && date_to
            render_date_filtered(connection, folder, folder_id, date_from, date_to)
            return
          end

          body = zoho_client.list_messages(
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            folder: folder,
            folder_id: folder_id,
            page: page
          )

          raw_messages = Array(body["data"])
          messages = raw_messages.map { |m| ::Zoho::MessagePresenter.summary(m) }
          per_page = 25

          # The same folder-total approximation the "Inbox"/"Total Emails"
          # KPI cards use (via fetch_stats, cached 45s) — NOT
          # raw_messages.length, which is just this one page's size (at most
          # per_page) and used to be reported as the "total" outright, so a
          # 300-message inbox showed "25 total" on page 1 while its own KPI
          # card showed a completely different number for the same folder.
          # `capped` means Zoho gave no way to confirm this is the real
          # total (see Zoho::Client::COUNT_CAP) — the frontend shows "200+"
          # rather than a falsely-precise "200" when this is true.
          real_total, capped = folder_total_count(connection, folder, folder_id)

          render json: {
            data: messages,
            meta: {
              page: page,
              perPage: per_page,
              totalPages: real_total.positive? ? (real_total.to_f / per_page).ceil : (raw_messages.length == per_page ? page + 1 : page),
              totalCount: real_total.positive? ? real_total : raw_messages.length,
              totalCountCapped: capped,
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

        private

        # fetch_stats is cached 45s per account, so this doesn't add a live
        # Zoho call on every page turn — just a cache read except right
        # after the cache expires.
        # Returns [count, capped] — capped means the count hit
        # Zoho::Client::COUNT_CAP and is a lower bound, not a real total.
        def folder_total_count(connection, folder, folder_id)
          stats = zoho_client.fetch_stats(access_token: connection.access_token, account_id: account_id_for(connection))
          folders = stats[:folders] || []
          match = if folder_id.present?
            folders.find { |f| f[:id].to_s == folder_id.to_s }
          else
            folders.find { |f| f[:name].to_s.casecmp?(folder.to_s) }
          end
          match ? [ match[:totalCount].to_i, match[:totalCountCapped] || false ] : [ 0, false ]
        rescue => e
          Rails.logger.warn("Could not resolve real folder total for meta.totalCount: #{e.message}")
          [ 0, false ]
        end

        def parse_filter_date(value)
          return nil if value.blank?

          Date.parse(value.to_s)
        rescue ArgumentError
          nil
        end

        def render_date_filtered(connection, folder, folder_id, date_from, date_to)
          result = ::Mail::DateFilteredMessages.call(
            zoho_client: zoho_client,
            access_token: connection.access_token,
            account_id: account_id_for(connection),
            folder: folder,
            folder_id: folder_id,
            from: date_from.beginning_of_day,
            to: date_to.end_of_day
          )
          messages = result.messages.map { |m| ::Zoho::MessagePresenter.summary(m) }

          render json: {
            data: messages,
            meta: {
              page: 1,
              perPage: messages.length,
              totalPages: 1,
              totalCount: messages.length,
              totalCountCapped: result.capped,
              folder: folder,
              folderId: folder_id
            }
          }
        end
      end
    end
  end
end
