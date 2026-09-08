module Api
  module V1
    class DocumentSerializer < ApplicationSerializer
      # Deliberately no direct file URL here — unlike the profile photo,
      # documents go through a dedicated, Pundit-checked download action
      # (see Api::V1::DocumentsController#download) that mints a
      # short-expiry signed URL fresh on each request, never a
      # standing one baked into the list/show response.
      attributes :id, :employee_id, :document_type, :title, :uploaded_by_id, :created_at

      attribute :employee_name do |document|
        document.employee&.full_name
      end

      attribute :filename do |document|
        document.file.attached? ? document.file.filename.to_s : nil
      end

      attribute :byte_size do |document|
        document.file.attached? ? document.file.byte_size : nil
      end
    end
  end
end
