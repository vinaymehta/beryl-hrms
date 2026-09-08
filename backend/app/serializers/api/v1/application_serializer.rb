module Api
  module V1
    # Shared base so every serializer gets camelCase JSON keys (matches the
    # frontend's TypeScript/JS conventions — see docs/API_CONVENTIONS.md)
    # without repeating `transform_keys` in each one.
    class ApplicationSerializer
      include Alba::Resource
      transform_keys :lower_camel
    end
  end
end
