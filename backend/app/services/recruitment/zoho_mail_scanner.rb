module Recruitment
  # Walks a Zoho inbox within a bounded time window, detects resume
  # attachments, and hands each one to the existing resume-processing
  # pipeline (ResumeProcessingJob) — unchanged from how it always worked.
  #
  # This is the one and only inbox-walking implementation, shared by two
  # independent callers that each choose `from`/`to` differently:
  #   - the manual "Scan Mail" action (an HR-picked date range)
  #   - ZohoAutoScanJob (continuous, cursor-based: "since the last
  #     successful automatic scan")
  # Keeping pagination, resume-attachment detection, and duplicate
  # prevention in one place means those two can never drift apart.
  class ZohoMailScanner
    MAX_SCAN_PAGES = 20
    SCAN_PAGE_SIZE = 25

    Result = Struct.new(
      :scanned_messages, :detected_resumes,
      :skipped_duplicate_attachments, :skipped_non_resume_attachments,
      keyword_init: true
    )

    def self.call(...) = new(...).call

    def initialize(company:, connection:, account_id:, from:, to:, zoho_client: ::Zoho::Client.new)
      @company = company
      @connection = connection
      @account_id = account_id
      @range_start = from
      @range_end = to
      @zoho_client = zoho_client
    end

    def call
      scanned_count = 0
      imported_count = 0
      skipped_duplicate_count = 0
      skipped_non_resume_count = 0

      # Resolved up front to the real Inbox id. Passing only the folder
      # NAME makes Zoho::Client fall back to a `search_messages(in:"inbox")`
      # call, and that search demonstrably returns messages from other
      # folders too — a Sent copy of the same mail came back alongside the
      # Inbox one, so every attachment got imported twice (once per copy,
      # under different attachment ids, so the attachment-level dedup
      # couldn't catch it — only the later file-hash check did, after the
      # download and processing work had already been spent).
      folder_id = inbox_folder_id

      MAX_SCAN_PAGES.times do |page_index|
        messages_resp = @zoho_client.list_messages(
          access_token: @connection.access_token,
          account_id: @account_id,
          folder: "inbox",
          folder_id: folder_id,
          page: page_index + 1,
          limit: SCAN_PAGE_SIZE
        )
        messages = Array(messages_resp["data"])
        break if messages.empty?

        in_range = messages.select { |msg| received_at(msg).between?(@range_start, @range_end) }
        scanned_count += in_range.size

        in_range.each do |msg|
          next unless msg["hasAttachment"].to_s == "1" || msg["hasAttachment"] == true || msg["attachments"].present?

          full_msg = @zoho_client.get_message(
            access_token: @connection.access_token,
            account_id: @account_id,
            message_id: msg["messageId"],
            folder_id: msg["folderId"]
          )
          attachments = Array(full_msg["attachments"])

          attachments.each do |att|
            name = att[:name].to_s.downcase
            unless name.end_with?(".pdf", ".docx", ".doc") || name.include?("resume") || name.include?("cv")
              skipped_non_resume_count += 1
              next
            end

            att_id = att[:id]
            if @company.candidate_resumes.exists?(source_attachment_id: att_id)
              skipped_duplicate_count += 1
              next
            end

            file_data = @zoho_client.download_attachment(
              access_token: @connection.access_token,
              account_id: @account_id,
              message_id: msg["messageId"],
              attachment_id: att_id
            )

            resume = @company.candidate_resumes.create!(
              file_name: file_data[:filename] || att["attachmentName"],
              content_type: file_data[:content_type] || "application/pdf",
              file_size: file_data[:body].bytesize,
              source: "zoho_mail",
              source_email_id: msg["messageId"],
              source_attachment_id: att_id,
              processing_status: :pending
            )

            resume.file.attach(
              io: StringIO.new(file_data[:body]),
              filename: resume.file_name,
              content_type: resume.content_type
            )

            ResumeProcessingJob.perform_later(resume.id)
            imported_count += 1
          end
        end

        # Inbox is listed newest-first — once an entire page is older than
        # the requested range, nothing further back is in range either.
        break if messages.all? { |msg| received_at(msg) < @range_start }
      end

      Result.new(
        scanned_messages: scanned_count,
        detected_resumes: imported_count,
        skipped_duplicate_attachments: skipped_duplicate_count,
        skipped_non_resume_attachments: skipped_non_resume_count
      )
    end

    private

    # nil is a safe fallback: Zoho::Client then behaves exactly as it did
    # before, so a folder lookup failure degrades to the old behaviour
    # rather than scanning nothing.
    def inbox_folder_id
      @zoho_client.fetch_folders(access_token: @connection.access_token, account_id: @account_id)
                  .find { |f| f[:name].to_s.casecmp?("inbox") }&.dig(:id)
    rescue => e
      Rails.logger.warn("[Recruitment::ZohoMailScanner] could not resolve inbox folder id: #{e.message}")
      nil
    end

    # Same receivedTime (epoch ms) field Zoho::MessagePresenter already
    # relies on for the mail workspace's own date display.
    def received_at(msg)
      ms = msg["receivedTime"].to_i
      ms > 0 ? Time.at(ms / 1000.0) : Time.current
    end
  end
end
