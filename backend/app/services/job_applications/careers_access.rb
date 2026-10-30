module JobApplications
  # The careers website's settings for sending applications, both from the
  # environment with no default:
  #
  #   CAREERS_API_KEY     the shared secret the website's server sends as
  #                       `Authorization: Bearer <key>`
  #   CAREERS_COMPANY_ID  the company applicants become candidates of —
  #                       job openings have no company, candidates do
  #
  # Unset, empty or pointing at no company raises NotConfigured, which the
  # controller answers with 503 rather than accepting applications nobody
  # could receive.
  module CareersAccess
    class NotConfigured < StandardError; end

    module_function

    def api_key
      ENV.fetch("CAREERS_API_KEY").presence || raise(NotConfigured, "CAREERS_API_KEY is empty")
    rescue KeyError
      raise NotConfigured, "CAREERS_API_KEY is not set"
    end

    def company
      id = ENV.fetch("CAREERS_COMPANY_ID")
      Company.find_by(id: id.presence) || raise(NotConfigured, "CAREERS_COMPANY_ID #{id.inspect} is not a company")
    rescue KeyError
      raise NotConfigured, "CAREERS_COMPANY_ID is not set"
    end

    # The bearer token from an Authorization header, or nil.
    def token_from(header)
      header.to_s[/\ABearer\s+(\S+)\z/, 1]
    end

    # Raises NotConfigured when there is no key to compare with.
    def valid_token?(token)
      key = api_key
      token.present? && ActiveSupport::SecurityUtils.secure_compare(token, key)
    end

    # For Rack::Attack, which must not raise: an unconfigured key is never
    # valid.
    def valid_token_quietly?(token)
      valid_token?(token)
    rescue NotConfigured
      false
    end
  end
end
