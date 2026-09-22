module Api
  module V1
    # §20 skill matrix. `validate` stamps who confirmed a skill and when, which
    # is the "evidence/validation" the scope asks for.
    class EmployeeSkillsController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: EmployeeSkill, association: :skills,
        params: %i[name proficiency evidence validated]
      )

      def validate_skill
        skill = find_record
        authorize skill, :update?
        skill.validate_by!(Current.user)
        render_data(serialize(skill))
      end
    end
  end
end
