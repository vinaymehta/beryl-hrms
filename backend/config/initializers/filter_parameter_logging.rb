# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  # Employee bank and identity numbers (encrypted at rest — see Employee). Not
  # `:pan`: partial matching would filter every `company` param as well.
  :account_number, :aadhaar, :pan_number, :other_identity_numbers
]
