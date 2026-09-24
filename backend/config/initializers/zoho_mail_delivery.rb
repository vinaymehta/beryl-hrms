# Makes `:zoho` selectable as an ActionMailer delivery method, alongside
# Rails' own `:smtp` / `:letter_opener` / `:test`.
#
# Registered here rather than in an environment file so every environment can
# choose it by name, and so the class is only referenced once — ActionMailer
# resolves delivery methods by the symbol from then on.
#
# to_prepare, not an eager `add_delivery_method` at boot: Zoho::MailDelivery is
# an autoloaded app/ class, and referencing it during initialization would
# either fail or pin a stale copy across a development reload.
Rails.application.config.to_prepare do
  ActionMailer::Base.add_delivery_method :zoho, Zoho::MailDelivery
end
