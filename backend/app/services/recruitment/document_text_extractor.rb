require "pdf-reader"
require "zip"
require "open3"
require "tempfile"

module Recruitment
  class DocumentTextExtractor
    def self.extract(io_or_path, filename: nil, content_type: nil)
      new(io_or_path, filename: filename, content_type: content_type).extract
    end

    def initialize(io_or_path, filename: nil, content_type: nil)
      @io_or_path = io_or_path
      @filename = filename.to_s
      @content_type = content_type.to_s
    end

    # Legacy binary .doc (pre-2007 Word) has no supported parser here — routing
    # it through the PDF/DOCX/plain-text fallback chain would silently return
    # garbled binary noise instead of a clear failure, so it's rejected upfront.
    UNSUPPORTED_FORMATS = %w[doc].freeze

    def extract
      ext = File.extname(@filename).downcase.delete(".")
      ext = detected_format_by_content_type if ext.blank?

      if UNSUPPORTED_FORMATS.include?(ext)
        return {
          text: "",
          char_count: 0,
          word_count: 0,
          format: ext,
          success: false,
          error: "Legacy .doc format is not supported for text extraction. Please provide a PDF or DOCX file."
        }
      end

      text = case ext
      when "pdf"
        extract_pdf
      when "docx"
        extract_docx
      when "txt", "text", "md", "csv"
        extract_plain_text
      else
        # Try PDF first, then DOCX, then plain text
        extract_with_fallback
      end

      cleaned_text = clean_text(text)
      words = cleaned_text.split.size
      {
        text: cleaned_text,
        char_count: cleaned_text.length,
        word_count: words,
        format: ext.presence || "unknown",
        success: cleaned_text.length.positive?,
        error: cleaned_text.length.positive? ? nil : "No readable text could be extracted from the document."
      }
    rescue => e
      Rails.logger.error("DocumentTextExtractor failed for '#{@filename}': #{e.message}")
      {
        text: "",
        char_count: 0,
        word_count: 0,
        format: ext.presence || "unknown",
        success: false,
        error: "Text extraction failed: #{e.message}"
      }
    end

    private

    def read_binary
      if @io_or_path.respond_to?(:read)
        @io_or_path.rewind if @io_or_path.respond_to?(:rewind)
        @io_or_path.read
      else
        @io_or_path.to_s
      end
    end

    def extract_pdf
      binary = read_binary
      return "" if binary.blank?

      text = extract_pdf_with_reader(binary)

      # pdf-reader resolves glyphs through the font's ToUnicode CMap. A PDF that
      # embeds a subset font WITHOUT one (LaTeX output is the common culprit)
      # yields plausible-looking text where whole runs are decorative symbols
      # instead of letters — e.g. a real contact line coming back as
      # "Email: ✐❛♠♥✐t✐♥✾✸✶❅❣♠❛✐❧✳❝♦♠". It doesn't raise, so without this check
      # the garbage flows on to the AI, which correctly refuses to invent an
      # email from it — and the candidate ends up with no address at all.
      if text.blank? || mojibake?(text)
        recovered = extract_pdf_with_pdftotext(binary)
        if recovered.present? && (text.blank? || !mojibake?(recovered))
          Rails.logger.info("[DocumentTextExtractor] '#{@filename}': pdf-reader output unusable, used pdftotext instead")
          return recovered
        end
      end

      text
    rescue => e
      Rails.logger.warn("PDF extraction error: #{e.message}")
      ""
    end

    def extract_pdf_with_reader(binary)
      reader = PDF::Reader.new(StringIO.new(binary))
      pages_text = reader.pages.map do |page|
        page.text
      rescue => e
        Rails.logger.warn("PDF page extraction warning: #{e.message}")
        ""
      end
      pages_text.join("\n")
    rescue => e
      Rails.logger.warn("PDF extraction error (pdf-reader): #{e.message}")
      ""
    end

    # Codepoints from the Dingbats / Miscellaneous-Symbols / Playing-card
    # blocks. Deliberately NOT "any non-ASCII": accented names, non-Latin
    # scripts, bullets and dashes are all legitimate resume text, and treating
    # those as corruption would send perfectly good extractions down the
    # fallback path. These decorative blocks are what a missing ToUnicode map
    # actually produces, and they essentially never occur in real resume prose.
    MOJIBAKE_RANGE = /[\u{2600}-\u{27BF}]/
    MOJIBAKE_MIN_HITS = 8
    MOJIBAKE_MIN_RATIO = 0.005

    def mojibake?(text)
      hits = text.scan(MOJIBAKE_RANGE).size
      return false if hits < MOJIBAKE_MIN_HITS

      hits.to_f / text.length >= MOJIBAKE_MIN_RATIO
    end

    # Poppler resolves glyphs from the embedded font program itself, so it
    # recovers text pdf-reader cannot. Optional by design: if the binary isn't
    # installed we simply keep whatever pdf-reader produced rather than failing
    # the resume. Invoked without a shell and with a hard timeout — the input is
    # an untrusted file from an inbound email.
    def extract_pdf_with_pdftotext(binary)
      return "" unless pdftotext_available?

      Tempfile.create([ "resume", ".pdf" ], binmode: true) do |file|
        file.write(binary)
        file.flush
        run_pdftotext(file.path)
      end
    rescue => e
      Rails.logger.warn("[DocumentTextExtractor] pdftotext error for '#{@filename}': #{e.class}: #{e.message}")
      ""
    end

    PDFTOTEXT_TIMEOUT = 20

    # Killed rather than waited on if it hangs: this runs inside a Sidekiq
    # worker on a file that arrived as an email attachment, so a malformed PDF
    # must not be able to pin a thread indefinitely.
    def run_pdftotext(path)
      out = +""
      Open3.popen3("pdftotext", "-q", "-enc", "UTF-8", path, "-") do |stdin, stdout, stderr, wait_thr|
        stdin.close
        stdout.binmode
        reader = Thread.new { out << stdout.read }

        unless wait_thr.join(PDFTOTEXT_TIMEOUT)
          Process.kill("KILL", wait_thr.pid) rescue nil
          reader.kill
          Rails.logger.warn("[DocumentTextExtractor] pdftotext timed out on '#{@filename}' after #{PDFTOTEXT_TIMEOUT}s")
          return ""
        end

        reader.join
        unless wait_thr.value.success?
          Rails.logger.warn("[DocumentTextExtractor] pdftotext failed for '#{@filename}': #{stderr.read.to_s.strip}")
          return ""
        end
      end

      out.force_encoding("UTF-8").scrub
    end

    def self.pdftotext_available?
      return @pdftotext_available unless @pdftotext_available.nil?

      @pdftotext_available = system("pdftotext", "-v", out: File::NULL, err: File::NULL) || false
    end

    def pdftotext_available?
      self.class.pdftotext_available?
    end

    def extract_docx
      binary = read_binary
      return "" if binary.blank?

      xml_content = ""
      Zip::File.open_buffer(StringIO.new(binary)) do |zip_file|
        entry = zip_file.find_entry("word/document.xml")
        xml_content = entry.get_input_stream.read if entry
      end

      # Strip XML tags to get raw text
      xml_content.gsub(/<[^>]*>/, " ").gsub(/\s+/, " ")
    rescue => e
      Rails.logger.warn("DOCX extraction error: #{e.message}")
      extract_printable_strings(binary)
    end

    def extract_plain_text
      read_binary.to_s.force_encoding("UTF-8").scrub
    end

    def extract_with_fallback
      pdf_result = extract_pdf rescue ""
      return pdf_result if pdf_result.length > 50

      docx_result = extract_docx rescue ""
      return docx_result if docx_result.length > 50

      extract_plain_text
    end

    def extract_printable_strings(binary)
      return "" if binary.blank?
      # Fallback: extract continuous ASCII/UTF-8 character sequences
      binary.to_s.scan(/[a-zA-Z0-9\s.,@:\-\/\\()]{4,}/).join(" ")
    end

    def detected_format_by_content_type
      case @content_type
      when %r{pdf}i then "pdf"
      when %r{wordprocessingml|docx}i then "docx"
      when %r{msword|doc}i then "doc"
      when %r{plain|text}i then "txt"
      else "unknown"
      end
    end

    def clean_text(str)
      return "" if str.blank?
      str.encode("UTF-8", invalid: :replace, undef: :replace, replace: " ")
         .gsub(/\r\n?/, "\n")
         .gsub(/[ \t]+/, " ")
         .gsub(/\n{3,}/, "\n\n")
         .strip
    end
  end
end
