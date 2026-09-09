require "pdf-reader"
require "zip"

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

      reader = PDF::Reader.new(StringIO.new(binary))
      pages_text = reader.pages.map do |page|
        page.text
      rescue => e
        Rails.logger.warn("PDF page extraction warning: #{e.message}")
        ""
      end
      pages_text.join("\n")
    rescue => e
      Rails.logger.warn("PDF extraction error: #{e.message}")
      ""
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
