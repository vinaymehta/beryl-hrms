module Api
  module V1
    # A generated SalarySlip, inside its row of the pay run. The amounts are
    # what the stored PDF printed; `outdated` (params[:outdated]) says the
    # salary on file has changed since.
    class SalarySlipSerializer < ApplicationSerializer
      attributes :id, :status, :generated_at, :sent_at, :sent_to

      %i[gross deductions net].each do |key|
        attribute(key) { |slip| ::Appraisals::SalaryStructure.storable(slip.public_send(key)) }
      end
      attribute :outdated do
        params[:outdated] || false
      end
    end
  end
end
