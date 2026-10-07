require "prawn"
require "prawn/table"

# Prawn warns on every document that the built-in fonts are not full UTF-8.
# Known and handled: LetterPdf#safe keeps every string inside their encoding.
Prawn::Fonts::AFM.hide_m17n_warning = true

module Appraisals
  # The appraisal letter, as PDF bytes. Worded after the company's reference
  # letter ("Reference Appraisal Letter 25-26"), with the employee's details,
  # the Discussion decision and the company's legal name filled in.
  #
  #   LetterPdf.call(appraisal)                      → the letter as issued
  #   LetterPdf.call(appraisal, signature: details)  → the same letter with the
  #                                                    employee's signature in
  #                                                    its signature block, and
  #                                                    an audit page after it
  #
  # The signed copy is REGENERATED from the same data rather than stamped onto
  # the stored PDF: Prawn writes PDFs, it does not edit them. Everything the
  # letter prints is fixed by the time it is issued — the decision can only be
  # changed at the Discussion step, which release leaves behind — so the two
  # render the same letter. The audit page records the SHA-256 of the stored
  # unsigned file, which is the one the employee was sent and read.
  #
  # Built-in Helvetica, not an embedded font: nothing to install on the server.
  # It covers Windows-1252, so the amounts are written "INR", as the reference
  # does, and any name outside that range is transliterated (see #safe).
  class LetterPdf
    class Error < StandardError; end

    # What the signed copy needs to know about the signing. `image` is the PNG
    # or JPEG bytes; `signed_at` a Time.
    Signature = Struct.new(:image, :name, :signed_at, :ip, :user_agent, :method, :email, :letter_sha256,
                           keyword_init: true)

    FONT = "Helvetica".freeze
    FONT_SIZE = 10.5
    MARGIN = 56
    SIGNATURE_BOX = [ 170, 56 ].freeze
    METHOD_LABELS = { "drawn" => "Drawn on screen", "uploaded" => "Uploaded image" }.freeze

    def self.call(...) = new(...).call

    def initialize(appraisal, signature: nil)
      @appraisal = appraisal
      @signature = signature
      @decision = appraisal.compensation_decision
      @employee = appraisal.employee
      @company = appraisal.company
    end

    def call
      blocker = @decision ? @decision.letter_blocker : "Save the decision with an effective date before releasing."
      raise Error, blocker if blocker

      pdf = Prawn::Document.new(page_size: "A4", margin: MARGIN, info: document_info)
      pdf.font(FONT, size: FONT_SIZE)
      pdf.default_leading 2

      header(pdf)
      opening(pdf)
      body(pdf)
      closing(pdf)
      signature_block(pdf)
      compensation_table(pdf)
      audit_page(pdf) if @signature

      pdf.render
    rescue Prawn::Errors::UnsupportedImageType => e
      raise Error, "The signature image can't be read (#{e.message}). Save it as a standard PNG or JPG and try again."
    end

    private
      def document_info
        {
          Title: safe("#{subject} — #{@employee.full_name}"),
          Author: safe(legal_name),
          Creator: "#{MailBranding::NAME} HRMS",
          CreationDate: Time.current
        }
      end

      # Logo top-left, when the file is there; the letter stands without it.
      def header(pdf)
        logo = MailBranding.logo_path
        if File.exist?(logo)
          pdf.image logo.to_s, width: 44, at: [ 0, pdf.cursor ]
          pdf.move_down 44
        end
        pdf.move_down 18
      end

      def opening(pdf)
        labelled(pdf, "Name", @employee.full_name)
        labelled(pdf, "Designation", current_designation.presence || "-")
        labelled(pdf, "Subject", subject)
        pdf.move_down 14

        paragraph(pdf, "Dear #{@employee.first_name},")
        paragraph(pdf, "Congratulations!", style: :bold)

        if promotion?
          paragraph(pdf, "We are hereby glad to inform that you have been promoted to #{proposed_designation} position " \
                         "and also your remuneration has been revised effective from #{long_date(effective_date)}.")
        else
          paragraph(pdf, "We are hereby glad to inform that your remuneration has been revised effective from " \
                         "#{long_date(effective_date)}.")
        end
      end

      # The fixed paragraphs, word for word as the reference has them.
      def body(pdf)
        paragraph(pdf, "Last one year has been eventful and challenging for all of us at #{legal_name}. We have met the " \
                       "huge challenge of scaling up our business and growing our bottom line.")
        paragraph(pdf, "We would like to express our appreciation and commendation for all the passion and commitment " \
                       "you have been exhibiting in your existing role.")
        paragraph(pdf, "In recognition of your contribution and passion towards work, it is our pleasure to inform you " \
                       "that your annual CTC has been revised to INR #{amount(annual_ctc)}/-. Your monthly gross " \
                       "emoluments will be INR #{amount(monthly_gross)}/-")
        paragraph(pdf, "This is in line to the different works we are trying to put efforts in. We would urge you to " \
                       "feel more responsible towards work this year and take up your roles more independently and wisely.")
        paragraph(pdf, "Congratulations on meeting this reward.")
        paragraph(pdf, "Revision is effective from #{long_date(effective_date)}. We hope that you continue to meet all " \
                       "the challenges that we will offer you in the coming year. Your Next Appraisal is due in " \
                       "#{next_appraisal.strftime('%B, %Y')}.")
        paragraph(pdf, "I hope this will encourage and motivate you to continue putting in your best and perform well " \
                       "on all projects you involve.")
        paragraph(pdf, "Please sign and return the duplicate copy in token of your acceptance.")
        paragraph(pdf, "Wish you all the Success!!")
      end

      # No company signature, by decision — the sign-off names the company and
      # the only signature on the letter is the employee's acceptance below.
      def closing(pdf)
        paragraph(pdf, "Best Wishes,", gap: 2)
        paragraph(pdf, "For #{legal_name}", style: :bold)
      end

      # The employee's acceptance: their signature over the line, with their
      # name and the date beneath. Blank — a line to sign on — until signed.
      def signature_block(pdf)
        box_width, box_height = SIGNATURE_BOX
        needed = box_height + 60
        pdf.start_new_page if pdf.cursor < needed

        pdf.move_down 10
        top = pdf.cursor
        if @signature
          pdf.image StringIO.new(@signature.image), fit: SIGNATURE_BOX, at: [ 0, top ]
        end
        pdf.move_down box_height + 4
        pdf.stroke_color "555555"
        pdf.stroke_horizontal_line 0, box_width
        pdf.stroke_color "000000"
        pdf.move_down 4
        pdf.text "Signature", style: :bold
        if @signature
          pdf.text safe(@signature.name)
          signed = local(@signature.signed_at)
          pdf.text "Signed on #{long_date(signed.to_date)} at #{signed.strftime('%-I:%M %p')} #{signed.zone}",
                   size: FONT_SIZE - 1, color: "444444"
        else
          pdf.text safe(@employee.full_name)
        end
        pdf.move_down 18
      end

      def compensation_table(pdf)
        rows = SalaryStructure::KEYS.map do |key|
          monthly = SalaryStructure.decimal(breakdown[key])
          [ SalaryStructure::LABELS.fetch(key), cell_amount(monthly), cell_amount(monthly * 12) ]
        end
        rows << [ "Monthly Gross", cell_amount(monthly_gross), cell_amount(monthly_gross * 12) ]

        # The heading and the table travel together: a heading stranded at the
        # foot of a page with its table on the next reads as a mistake.
        pdf.start_new_page if pdf.cursor < 300

        paragraph(pdf, "Your revised compensation and benefits structure are as follows:")
        pdf.text "COMPENSATION AND BENEFITS STRUCTURE", style: :bold, align: :center, size: FONT_SIZE + 1
        pdf.move_down 8

        pdf.table([ [ "Components", "Monthly INR.", "Annual INR." ] ] + rows,
                  header: true, width: pdf.bounds.width, column_widths: { 1 => 130, 2 => 130 },
                  cell_style: { size: FONT_SIZE, padding: [ 5, 8 ], border_color: "888888", border_width: 0.6 }) do |table|
          table.row(0).font_style = :bold
          table.row(0).background_color = "EDEDED"
          table.columns(1..2).align = :right
          table.row(0).columns(1..2).align = :right
          table.row(-1).font_style = :bold
          table.row(-1).background_color = "F5F5F5"
        end
      end

      # The record of the signing, on a page of its own after the letter.
      def audit_page(pdf)
        pdf.start_new_page
        pdf.text "Signature audit record", style: :bold, size: FONT_SIZE + 4
        pdf.move_down 4
        pdf.text "This page records how the letter above was accepted and signed.", color: "444444"
        pdf.move_down 14

        zone = local(@signature.signed_at)
        rows = [
          [ "Document", safe("#{subject} — #{@appraisal.appraisal_cycle&.name}") ],
          [ "Employee", safe([ @employee.full_name, @employee.employee_code.presence ].compact.join(" · ")) ],
          [ "Signed by", safe(@signature.name) ],
          [ "User", safe(@signature.email.presence || "-") ],
          [ "Signed at", signed_at_text(zone) ],
          [ "IP address", safe(@signature.ip.presence || "-") ],
          [ "User agent", safe(@signature.user_agent.presence || "-") ],
          [ "Signature method", METHOD_LABELS.fetch(@signature.method.to_s, @signature.method.to_s.humanize.presence || "-") ],
          [ "Acceptance", "The signer confirmed \"I have read and accept this letter\" before signing." ],
          [ "SHA-256 of the issued letter", @signature.letter_sha256.presence || "-" ]
        ]

        pdf.table(rows, width: pdf.bounds.width, column_widths: { 0 => 150 },
                        cell_style: { size: FONT_SIZE - 0.5, padding: [ 6, 8 ], border_color: "AAAAAA", border_width: 0.5 }) do |table|
          table.column(0).font_style = :bold
          table.column(0).background_color = "F3F3F3"
          # Courier at 8pt keeps the 64 hex digits on one line, so the value
          # can be read off and compared without guessing where it wrapped.
          table.row(-1).column(1).font = "Courier"
          table.row(-1).column(1).size = 8
        end

        pdf.move_down 14
        pdf.text "The SHA-256 above is the fingerprint of the unsigned letter as it was issued to the employee. " \
                 "Any change to that file would produce a different value.", size: FONT_SIZE - 1.5, color: "555555"
      end

      # "7 October 2026, 12:32:42 PM IST (Chennai)" — the zone's name only
      # when the abbreviation doesn't already say it.
      def signed_at_text(time)
        text = "#{time.strftime('%-d %B %Y, %I:%M:%S %p')} #{time.zone}"
        time.zone == time.time_zone.name ? text : "#{text} (#{time.time_zone.name})"
      end

      def labelled(pdf, label, value)
        pdf.formatted_text [ { text: "#{label}: ", styles: [ :bold ] }, { text: safe(value.to_s) } ]
        pdf.move_down 2
      end

      def paragraph(pdf, text, style: nil, gap: 9)
        pdf.text safe(text), style: style, align: :justify
        pdf.move_down gap
      end

      # --- Data ---------------------------------------------------------------
      def subject = promotion? ? "Promotion & Appraisal Letter" : "Appraisal Letter"

      def promotion? = @decision.promotion_recommended? && proposed_designation.present?

      def proposed_designation = @decision.proposed_designation&.title

      # The designation the decision was measured from — recorded on it when
      # it was made — falling back to the profile's for a decision without one.
      def current_designation
        (@decision.current_designation || @employee.designation)&.title
      end

      def legal_name = @company.letter_legal_name

      def effective_date = @decision.effective_date

      def next_appraisal = @decision.next_appraisal_on || (effective_date + 1.year)

      def breakdown = @decision.breakdown

      def monthly_gross = SalaryStructure.monthly_gross(breakdown)

      def annual_ctc = SalaryStructure.annual_ctc(breakdown)

      def amount(value) = SalaryStructure.format_amount(value)

      # A zero row reads "-", as the reference prints it.
      def cell_amount(value) = value.zero? ? "-" : amount(value)

      # "1 July, 2025", the reference's form.
      def long_date(date) = date.strftime("%-d %B, %Y")

      def local(time)
        zone = Time.find_zone(@company.timezone) || Time.zone
        time.in_time_zone(zone)
      end

      # Helvetica's built-in encoding is Windows-1252. A name outside it would
      # make Prawn raise mid-letter, so it is transliterated instead
      # ("Zoë" stays, "Łukasz" becomes "Lukasz"); anything left is a "?".
      def safe(text)
        text = text.to_s
        text.encode("Windows-1252")
        text
      rescue Encoding::UndefinedConversionError
        I18n.transliterate(text)
      end
  end
end
