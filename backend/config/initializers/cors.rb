# Cross-origin access for the Next.js frontend, which lives on a different
# origin (port in development, subdomain in production) but shares the same
# parent registrable domain — see docs/ARCHITECTURE.md for why that's the
# deployment assumption that makes SameSite=Lax cookies work here.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_ORIGINS", "http://localhost:3000").split(",").map(&:strip)

    resource "/api/*",
      headers: :any,
      expose: %w[X-CSRF-Token],
      methods: %i[get post put patch delete options head],
      credentials: true
  end
end
