module Recruitment
  # The content type a resume is stored with when the source didn't say
  # anything useful about it.
  #
  # Zoho's attachment download answers application/octet-stream (or no
  # Content-Type at all) for a large share of genuine attachments. Storing
  # that — or, as the importers used to, falling back to a blanket
  # "application/pdf" — mislabels files: a DOCX stored as application/pdf is
  # handed to the PDF renderer by the preview window and to the PDF branch
  # of text extraction. So a generic reported type is replaced by what the
  # file name says, and failing that by the file's own leading bytes.
  # A specific type the source did report is kept as-is.
  module ResumeContentType
    PDF = "application/pdf".freeze
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".freeze
    DOC = "application/msword".freeze
    OCTET_STREAM = "application/octet-stream".freeze

    BY_EXTENSION = { ".pdf" => PDF, ".docx" => DOCX, ".doc" => DOC }.freeze

    # Types that only mean "some bytes" — no better than no type at all.
    GENERIC = [ "", OCTET_STREAM, "binary/octet-stream", "application/x-download", "application/force-download" ].freeze

    def self.resolve(filename:, reported: nil, body: nil)
      # Header values can carry parameters ("application/pdf; name=cv.pdf");
      # everything downstream compares the bare type.
      type = reported.to_s.split(";").first.to_s.strip.downcase
      return type unless GENERIC.include?(type)

      BY_EXTENSION[File.extname(filename.to_s).downcase] || sniff(body) || OCTET_STREAM
    end

    # Magic numbers, for a file whose name has no usable extension. DOCX is
    # a ZIP container; a bare ZIP signature is only trusted as DOCX because
    # every caller here deals in resumes, where that's the one ZIP format
    # that gets through the resume-attachment filter.
    def self.sniff(body)
      head = body.to_s.byteslice(0, 8).to_s.b
      return PDF if head.start_with?("%PDF".b)
      return DOCX if head.start_with?("PK\x03\x04".b)
      return DOC if head.start_with?("\xD0\xCF\x11\xE0".b)

      nil
    end
  end
end
