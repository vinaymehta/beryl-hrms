# Which Active Storage service to use: S3 when it is configured, the server's
# own disk when it isn't. Read by config/environments/{development,production}.rb.
#
# "Configured" means the three values S3 cannot work without. S3_ENDPOINT and
# S3_FORCE_PATH_STYLE are optional (MinIO/R2 need them, AWS S3 doesn't).
module StorageService
  REQUIRED_ENV = %w[S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY].freeze

  def self.s3_configured?
    REQUIRED_ENV.all? { |key| ENV[key].to_s.strip != "" }
  end

  # :s3_compatible and :local are both defined in config/storage.yml.
  def self.service
    s3_configured? ? :s3_compatible : :local
  end
end
