module Api
  module V1
    class DocumentSerializer < ApplicationSerializer
      # Deliberately no direct file URL here — unlike the profile photo,
      # documents go through a dedicated, Pundit-checked download action
      # (see Api::V1::DocumentsController#download) that mints a
      # short-expiry signed URL fresh on each request, never a
      # standing one baked into the list/show response.
      # document_type holds the CATEGORY key (see Document::CATEGORIES);
      # custom_category carries the typed name when that key is "other".
      # Both are sent raw — the client owns the display labels, so renaming one
      # in the UI never has to touch stored data.
      attributes :id, :employee_id, :document_type, :custom_category, :title, :uploaded_by_id, :created_at

      attribute :employee_name do |document|
        document.employee&.full_name
      end

      attribute :filename do |document|
        document.file.attached? ? document.file.filename.to_s : nil
      end

      attribute :byte_size do |document|
        document.file.attached? ? document.file.byte_size : nil
      end

      attribute :content_type do |document|
        document.file.attached? ? document.file.content_type : nil
      end
    end
  end
end
