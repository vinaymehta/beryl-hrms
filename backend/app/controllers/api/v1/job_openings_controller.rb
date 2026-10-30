module Api
  module V1
    # Job Administration: the openings on the public careers website (which
    # reads them through Public::JobOpeningsController). Gated by
    # job_openings.manage — see JobOpeningPolicy.
    #
    # Validation failures answer per field (`errors[].field`, camelCase) so the
    # form can put each message under its own input.
    class JobOpeningsController < Api::V1::BaseController
      PERMITTED = [
        :code, :slug, :title, :category, :employment_type, :location, :date_posted,
        :summary, :intro, :about, :growth_heading, :role_question, :is_active,
        { responsibilities: [], requirements: [], nice_to_have: [], growth_items: [] }
      ].freeze
      SORT_STEP = 10

      rescue_from ActiveRecord::RecordInvalid, with: :render_invalid
      rescue_from ActiveRecord::RecordNotUnique, with: :render_taken

      # Every opening, paused ones included, in the website's order.
      def index
        authorize JobOpening
        render_data(serialize(policy_scope(JobOpening).ordered))
      end

      def show
        opening = find_opening
        authorize opening
        render_data(serialize(opening))
      end

      # A blank code or slug is filled in by the model; a new opening goes to
      # the end of the list.
      def create
        authorize JobOpening
        opening = JobOpening.new(opening_params)
        opening.sort_order = next_sort_order
        JobOpening.transaction do
          opening.save!
          audit("job_opening.created", opening)
        end
        render_data(serialize(opening), status: :created)
      end

      def update
        opening = find_opening
        authorize opening
        JobOpening.transaction do
          opening.update!(opening_params)
          audit("job_opening.updated", opening)
        end
        render_data(serialize(opening))
      end

      def destroy
        opening = find_opening
        authorize opening
        JobOpening.transaction do
          opening.destroy!
          audit("job_opening.deleted", opening, before_changes: opening.slice(:code, :slug, :title))
        end
        head :no_content
      end

      def activate = set_active(true, "job_opening.activated")
      def pause = set_active(false, "job_opening.paused")

      # A paused copy at the end of the list, with its own code and slug, so it
      # can be edited before anyone sees it.
      def duplicate
        original = find_opening
        authorize original, :create?
        copy = original.dup
        copy.assign_attributes(
          title: "Copy of #{original.title}".first(JobOpening::LIMITS[:title]),
          code: ::JobOpenings::Identifiers.unique_variant(:code, original.code),
          slug: ::JobOpenings::Identifiers.unique_variant(:slug, original.slug),
          is_active: false,
          date_posted: Date.current,
          sort_order: next_sort_order,
          created_at: nil,
          updated_at: nil
        )
        JobOpening.transaction do
          copy.save!
          audit("job_opening.duplicated", copy, before_changes: { "source_id" => original.id })
        end
        render_data(serialize(copy), status: :created)
      end

      # `ids` is every opening, in the new order; each gets sort_order 10, 20,
      # 30… A list that isn't exactly the current set of openings (someone
      # added or deleted one meanwhile) is refused rather than half-applied.
      def reorder
        authorize JobOpening
        ids = Array(params[:ids]).map(&:to_i)
        current = policy_scope(JobOpening).pluck(:id)
        if ids.uniq.size != ids.size || ids.sort != current.sort
          return render json: { errors: [ { code: "stale_order", message: "The list changed while you were reordering it. Refresh and try again." } ] },
                        status: :unprocessable_content
        end

        JobOpening.transaction do
          ids.each_with_index do |id, index|
            JobOpening.where(id: id).update_all(sort_order: (index + 1) * SORT_STEP)
          end
          audit("job_opening.reordered", nil, after_changes: { "ids" => ids })
        end
        render_data(serialize(policy_scope(JobOpening).ordered))
      end

      # What the form offers for code and slug, and whether the ones typed are
      # free. `exceptId` is the opening being edited, so its own values count
      # as available.
      def suggest_identifiers
        authorize JobOpening, :index?
        except_id = params[:exceptId].presence&.to_i
        identifiers = ::JobOpenings::Identifiers
        render_data({
          code: identifiers.code_for(params[:title], params[:category], except_id: except_id),
          slug: identifiers.slug_for(params[:title], except_id: except_id),
          codeAvailable: params[:code].present? ? identifiers.available?(:code, params[:code], except_id: except_id) : nil,
          slugAvailable: params[:slug].present? ? identifiers.available?(:slug, params[:slug], except_id: except_id) : nil
        })
      end

      private
        def find_opening
          policy_scope(JobOpening).find(params[:id])
        end

        def opening_params
          params.permit(*PERMITTED)
        end

        def next_sort_order
          (JobOpening.maximum(:sort_order) || 0) + SORT_STEP
        end

        def set_active(active, action)
          opening = find_opening
          authorize opening, :update?
          JobOpening.transaction do
            opening.update!(is_active: active)
            audit(action, opening)
          end
          render_data(serialize(opening))
        end

        # Counted within the current company: applications are tenanted,
        # openings aren't.
        def serialize(records)
          counts = JobApplication.where(job_opening_id: Array(records).map(&:id)).group(:job_opening_id).count
          Api::V1::JobOpeningSerializer.new(records, params: { application_counts: counts }).as_json
        end

        def audit(action, opening, before_changes: nil, after_changes: nil)
          ::Audit::Record.call(action: action, auditable: opening, request: request,
                               before_changes: before_changes, after_changes: after_changes)
        end

        def render_invalid(exception)
          errors = exception.record.errors.map do |error|
            { code: "invalid", field: error.attribute.to_s.camelize(:lower), message: error.full_message }
          end
          render json: { errors: errors }, status: :unprocessable_content
        end

        # Two saves racing for the same code or slug: the validation passed for
        # both and the unique index caught the second.
        def render_taken(exception)
          field = exception.message.include?("index_job_openings_on_slug") ? "slug" : "code"
          render json: { errors: [ { code: "invalid", field: field,
                                     message: "#{field.capitalize} is already used by another opening" } ] },
                 status: :unprocessable_content
        end
    end
  end
end
