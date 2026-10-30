module Api
  module V1
    module Public
      # PUBLIC, read-only — the careers website's source of openings. No
      # login, no tenant (JobOpening is single-company and not tenant-scoped)
      # and no cookies: nothing here is session-bound, so the CSRF cookie
      # every other response mints is skipped too.
      #
      # Only active openings exist as far as this controller is concerned: a
      # paused one answers the same 404 as a slug that was never used.
      class JobOpeningsController < Api::V1::BaseController
        allow_unauthenticated_access only: %i[index show]
        skip_before_action :set_current_tenant, only: %i[index show]
        skip_before_action :ensure_csrf_cookie, only: %i[index show]

        # GET /api/v1/public/job_openings
        def index
          render_data(serialize(JobOpening.active.ordered))
        end

        # GET /api/v1/public/job_openings/:slug
        def show
          render_data(serialize(JobOpening.active.find_by!(slug: params[:slug].to_s.downcase)))
        end

        private
          def serialize(records)
            Api::V1::Public::JobOpeningSerializer.new(records).as_json
          end
      end
    end
  end
end
