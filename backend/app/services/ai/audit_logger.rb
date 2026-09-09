module Ai
  # Dedicated, queryable AI-call audit trail (spec: provider/model/candidate-or-
  # resume id/status/duration/prompt version/timestamp) — distinct from the
  # transient ai_metadata blob stored inline on candidate_resumes/matches,
  # which gets overwritten on reprocess and can't be queried historically.
  #
  # Deliberately swallows its own errors: a failure to write an audit row must
  # never take down the resume-processing or matching flow it's observing.
  class AuditLogger
    def self.record(operation:, status:, metadata: {}, company: nil, resume: nil, candidate: nil, job: nil, error: nil)
      resolved_company = company || resume&.company || candidate&.company || job&.company
      return unless resolved_company

      AiProcessingLog.create!(
        company: resolved_company,
        candidate_resume: resume,
        candidate: candidate,
        job: job,
        operation: operation,
        provider: metadata[:provider] || metadata["provider"],
        model: metadata[:model] || metadata["model"],
        prompt_version: metadata[:prompt_version] || metadata["prompt_version"],
        duration_ms: metadata[:duration_ms] || metadata["duration_ms"],
        status: status,
        error_message: error&.message&.truncate(500)
      )
    rescue => e
      Rails.logger.error("Ai::AuditLogger failed to record #{operation}: #{e.message}")
    end
  end
end
