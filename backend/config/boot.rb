ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)

require "bundler/setup" # Set up gems listed in the Gemfile.

# Load the monorepo-root .env (shared with docker-compose and the frontend)
# rather than a backend-local one, so DATABASE_*/REDIS_URL/S3_* stay defined
# in exactly one place. dotenv is a development/test-only gem (production
# gets real env vars from the deployment platform, and production Docker
# builds exclude this group), so only load it outside production.
if ENV["RAILS_ENV"] != "production" && ENV["RACK_ENV"] != "production"
  require "dotenv"
  loaded = Dotenv.load(File.expand_path("../../.env", __dir__))
  # An empty `KEY=` in .env means "not set": drop it, so Rails and every gem
  # (which test `ENV["KEY"] ||`, where "" counts as set) use their own default
  # instead of an empty string. Only keys .env left empty — never a value the
  # shell exported.
  loaded.each_key { |key| ENV.delete(key) if ENV[key].to_s.strip.empty? }
end

require "bootsnap/setup" # Speed up boot time by caching expensive operations.
