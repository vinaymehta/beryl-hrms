# No single global switch for key transformation in Alba — each resource
# class sets it via `transform_keys`. Api::V1::ApplicationSerializer (the
# shared base every serializer inherits from) does that once; this
# initializer just sets the JSON encoder backend.
Alba.backend = :active_support
