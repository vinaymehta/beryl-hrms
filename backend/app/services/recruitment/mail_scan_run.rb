module Recruitment
  # Progress of one manual "Scan Mail" request.
  #
  # A manual scan fans out to one ZohoMailboxScanJob per chosen mailbox so
  # the mailboxes are scanned in parallel, which means the request can no
  # longer wait for the scan and answer with its counts. Each job reports
  # into this record instead, and the Scan Mail panel polls it.
  #
  # Held in Redis (one hash per run, a field per mailbox) for the same reason
  # ZohoMailboxScanJob's lock is: the web and Sidekiq processes don't share
  # Rails.cache (:memory_store in development). It is throwaway progress, not
  # history — it expires on its own and nothing else reads it.
  class MailScanRun
    TTL = 6.hours
    FINISHED = %w[completed failed].freeze

    def self.start!(company:, connections:, from:, to:)
      id = SecureRandom.uuid
      key = key_for(id)

      Sidekiq.redis do |redis|
        redis.hset(key, "meta", { companyId: company.id, from: from.to_date.iso8601, to: to.to_date.iso8601 }.to_json)
        connections.each do |connection|
          redis.hset(key, field_for(connection.id), {
            connectionId: connection.id.to_s, emailAddress: connection.email_address, status: "queued"
          }.to_json)
        end
        redis.expire(key, TTL.to_i)
      end

      id
    end

    # Called from a mailbox's own job only, so no two writers ever share a
    # field and a plain read-merge-write is safe.
    def self.update(id, connection_id, **attrs)
      return if id.blank?

      key = key_for(id)
      Sidekiq.redis do |redis|
        current = redis.hget(key, field_for(connection_id))
        next if current.nil?

        merged = JSON.parse(current).merge(attrs.transform_keys { |k| k.to_s.camelize(:lower) })
        redis.hset(key, field_for(connection_id), merged.to_json)
      end
    end

    # nil when the run is unknown, expired, or belongs to another company —
    # the id is a bearer token of sorts, so the company check is what keeps
    # one tenant from reading another's run.
    def self.fetch(id, company:)
      return nil if id.blank?

      fields = Sidekiq.redis { |redis| redis.hgetall(key_for(id)) }
      meta = fields.delete("meta")
      return nil if meta.nil?

      meta = JSON.parse(meta)
      return nil unless meta["companyId"] == company.id

      accounts = fields.values.map { |raw| JSON.parse(raw) }.sort_by { |a| a["connectionId"].to_i }
      {
        scanId: id,
        from: meta["from"],
        to: meta["to"],
        finished: accounts.all? { |a| FINISHED.include?(a["status"]) },
        accounts: accounts
      }
    end

    def self.key_for(id) = "zoho_mail_scan_run/#{id}"
    def self.field_for(connection_id) = "connection/#{connection_id}"
    private_class_method :key_for, :field_for
  end
end
