module Api
  module V1
    module Public
      # What the careers website reads. snake_case, NOT the app's camelCase:
      # the website was built against the table's own column names, so this
      # deliberately doesn't inherit ApplicationSerializer (whose
      # transform_keys :lower_camel would rename them). Every column, in the
      # table's order — the website's contract, so change it with the website.
      class JobOpeningSerializer
        include Alba::Resource

        attributes :id, :code, :slug, :title, :category, :employment_type, :location, :date_posted,
                   :summary, :intro, :about, :responsibilities, :requirements, :nice_to_have,
                   :growth_heading, :growth_items, :role_question, :is_active, :sort_order,
                   :created_at, :updated_at
      end
    end
  end
end
