require "cgi"

module Zoho
  module MessagePresenter
    def self.summary(raw)
      received_ms = raw["receivedTime"].to_i
      received_at = received_ms > 0 ? Time.at(received_ms / 1000.0).iso8601 : Time.current.iso8601

      {
        id: raw["messageId"].to_s,
        folderId: raw["folderId"].to_s,
        from: CGI.unescapeHTML(raw["fromAddress"] || raw["sender"] || ""),
        to: CGI.unescapeHTML(raw["toAddress"] || ""),
        subject: CGI.unescapeHTML(raw["subject"].presence || "(no subject)"),
        snippet: CGI.unescapeHTML(raw["summary"] || raw["snippet"] || ""),
        receivedAt: received_at,
        isRead: raw["status"].to_s == "1" || raw["isRead"] == true,
        hasAttachment: raw["hasAttachment"].to_s == "1" || raw["hasAttachment"] == true
      }
    end

    def self.detail(raw)
      received_ms = raw["receivedTime"].to_i
      received_at = received_ms > 0 ? Time.at(received_ms / 1000.0).iso8601 : Time.current.iso8601

      {
        id: raw["messageId"].to_s,
        from: CGI.unescapeHTML(raw["fromAddress"] || raw["sender"] || ""),
        to: CGI.unescapeHTML(raw["toAddress"] || ""),
        subject: CGI.unescapeHTML(raw["subject"].presence || "(no subject)"),
        body: raw["content"].presence || raw["summary"] || "",
        receivedAt: received_at,
        isRead: raw["status"].to_s == "1" || raw["isRead"] == true,
        hasAttachment: raw["hasAttachment"].to_s == "1" || raw["hasAttachment"] == true,
        attachments: Array(raw["attachments"])
      }
    end
  end
end
