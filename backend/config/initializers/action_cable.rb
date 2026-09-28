# The live-notification socket (/cable) is opened by the Next.js frontend from
# its own origin, so it is allowed from exactly the origins CORS allows.
Rails.application.config.action_cable.allowed_request_origins = FrontendOrigins.all
