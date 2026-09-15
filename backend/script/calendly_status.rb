# Local testing helper: shows where the Calendly interview flow currently
# stands. Read-only — safe to run at any point.
#
#   bin/rails runner script/calendly_status.rb
#
# COMPANY_ID defaults to 16; override with COMPANY_ID=n.
company = Company.find(ENV.fetch("COMPANY_ID", 16).to_i)

ActsAsTenant.with_tenant(company) do
  puts "== config =="
  puts "  redirect URI : #{ENV['CALENDLY_REDIRECT_URI'].inspect}"
  puts "  webhook URL  : #{Calendly::WebhookRegistrar.callback_url_from_env.inspect}"
  puts "  signing key  : #{ENV['CALENDLY_WEBHOOK_SIGNING_KEY'].present? ? 'set' : 'MISSING — webhooks will be rejected'}"
  puts "  client id    : #{ENV['CALENDLY_CLIENT_ID'].present? ? 'set' : 'MISSING'}"

  puts "\n== connection =="
  conn = company.calendly_connections.order(created_at: :desc).first
  if conn.nil?
    puts "  none — connect at /settings/interviews"
  else
    puts "  account      : #{conn.email_address.inspect} (#{conn.status})"
    puts "  event type   : #{conn.default_event_type_uri.presence || 'NOT CHOSEN — scheduling will refuse'}"
    puts "  webhook      : #{conn.webhook_subscription_uri.presence || 'NOT REGISTERED — bookings will not change any status'}"
    puts "  ready?       : #{conn.ready?}"
  end

  puts "\n== candidates in the interview flow =="
  scope = Candidate.where(status: Candidate::INTERVIEW_WORKFLOW_STATUSES)
                   .or(Candidate.where.not(interview_link_sent_at: nil))
  if scope.none?
    puts "  none yet"
  else
    scope.order(:id).each do |c|
      puts format("  ##{c.id} %-18s %-22s interviewer=%-16s at=%s",
                  c.full_name.to_s[0, 17], c.status,
                  c.interviewer&.full_name.to_s[0, 15],
                  c.interview_at&.in_time_zone("Asia/Kolkata")&.strftime("%d %b %I:%M %p IST") || "-")
      puts "        booking link: #{c.calendly_scheduling_url}" if c.calendly_scheduling_url.present?
    end
  end
end
