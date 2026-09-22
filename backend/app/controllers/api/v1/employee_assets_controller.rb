module Api
  module V1
    class EmployeeAssetsController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: EmployeeAsset, association: :assets,
        params: %i[name asset_type identifier status assigned_on returned_on note]
      )
    end
  end
end
