# Building blocks for mail templates. Table-based and inline-styled, because
# that is what every mail client (Outlook included) lays out the same way.
module MailHelper
  # The one call to action in a message.
  def mail_button(label, url)
    content_tag(:table, role: "presentation", cellpadding: 0, cellspacing: 0, border: 0, style: "margin:20px 0") do
      content_tag(:tr) do
        content_tag(:td, style: "border-radius:8px;background:#111111") do
          link_to(label, url, style: "display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;" \
                                     "color:#ffffff;text-decoration:none;border-radius:8px")
        end
      end
    end
  end

  # The raw link under a button, for clients that strip buttons.
  def mail_fallback_link(url)
    content_tag(:p, style: "margin:0 0 16px;font-size:12px;color:#6b7280;word-break:break-all") do
      safe_join([ "If the button doesn't work, paste this link into your browser:", tag.br,
                  link_to(url, url, style: "color:#4b5563") ])
    end
  end
end
