require "rails_helper"

RSpec.describe Zoho::Client do
  # Zoho percent-encodes the filename inside the Content-Disposition header, so
  # a resume arrived as "Saman_Kumar_Jha%20resume%20%281%29.pdf" and was stored,
  # listed and re-downloaded under exactly that name.
  describe "attachment filename decoding" do
    subject(:client) { described_class.new }

    def decode(raw) = client.send(:decode_filename, raw)

    it "turns percent escapes back into the real characters" do
      expect(decode("Saman_Kumar_Jha%20resume%20%281%29.pdf")).to eq("Saman_Kumar_Jha resume (1).pdf")
      expect(decode("CORPORATE%20PARTNERSHIP%20PROPOSAL.pdf")).to eq("CORPORATE PARTNERSHIP PROPOSAL.pdf")
    end

    it "leaves an already-plain name untouched" do
      expect(decode("Pushkar_Singhal_Resume.pdf")).to eq("Pushkar_Singhal_Resume.pdf")
    end

    # Form encoding turns "+" into a space; a filename is not a form field, and
    # "+" is an ordinary character in one.
    it "does not treat + as a space" do
      expect(decode("C++%20notes.pdf")).to eq("C++ notes.pdf")
    end

    # "50%off.pdf" is not valid percent-encoding. Keeping the odd-looking name
    # beats losing the attachment to an exception.
    it "keeps a name whose % is not a valid escape" do
      expect(decode("50%off.pdf")).to eq("50%off.pdf")
    end

    # %2F decodes to "/", which would otherwise put a path separator into a
    # value that is used as a filename.
    it "strips any path introduced by decoding" do
      expect(decode("..%2F..%2Fetc%2Fpasswd")).to eq("passwd")
    end
  end
end
