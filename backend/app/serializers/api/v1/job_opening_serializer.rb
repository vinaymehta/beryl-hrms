module Api
  module V1
    # Job Administration's view of an opening — camelCase like the rest of the
    # app's API. The careers website reads Public::JobOpeningSerializer instead.
    class JobOpeningSerializer < ApplicationSerializer
      attributes :id, :code, :slug, :title, :category, :employment_type, :location, :date_posted,
                 :summary, :intro, :about, :responsibilities, :requirements, :nice_to_have,
                 :growth_heading, :growth_items, :role_question, :is_active, :sort_order,
                 :created_at, :updated_at

      # Applications from the careers website, counted by the controller in
      # one query (`params[:application_counts]`, opening id => count).
      attribute :applications_count do |opening|
        params.fetch(:application_counts, {}).fetch(opening.id, 0)
      end
    end
  end
end
