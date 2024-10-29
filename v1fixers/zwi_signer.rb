#!/usr/bin/env ruby
require 'json'
require 'digest'
require 'jwt'
require 'fileutils'
require 'openssl'

# Base directory where the numbered directories are located
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"
IDENTITY_DIR = "./identity"  # Location of identity files

def decode_octets(base64_encoded_coordinate)
  bytes = ::JWT::Base64.url_decode(base64_encoded_coordinate)
  # Some base64 encoders on some platform omit a single 0-byte at
  # the start of either Y or X coordinate of the elliptic curve point.
  # This leads to an encoding error when data is passed to OpenSSL BN.
  # It is know to have happend to exported JWKs on a Java application and
  # on a Flutter/Dart application (both iOS and Android). All that is
  # needed to fix the problem is adding a leading 0-byte. We know the
  # required byte is 0 because with any other byte the point is no longer
  # on the curve - and OpenSSL will actually communicate this via another
  # exception. The indication of a stripped byte will be the fact that the
  # coordinates - once decoded into bytes - should always be an even
  # bytesize. For example, with a P-521 curve, both x and y must be 66 bytes.
  # With a P-256 curve, both x and y must be 32 and so on. The simplest way
  # to check for this truncation is thus to check whether the number of bytes
  # is odd, and restore the leading 0-byte if it is.
  if bytes.bytesize.odd?
    ZERO_BYTE + bytes
  else
    bytes
  end
end

# Grabbed from https://github.com/jwt/ruby-jwt/blob/main/lib/jwt/jwk/ec.rb
# Adapted by Henry Sanger.
def create_ec_key(jwk_x, jwk_y, jwk_d)
    curve = 'secp384r1'
    x_octets = decode_octets(jwk_x)
    y_octets = decode_octets(jwk_y)

    point = OpenSSL::PKey::EC::Point.new(
      OpenSSL::PKey::EC::Group.new(curve),
      OpenSSL::BN.new([0x04, x_octets, y_octets].pack('Ca*a*'), 2)
    )

    sequence = if jwk_d
                 # https://datatracker.ietf.org/doc/html/rfc5915.html
                 # ECPrivateKey ::= SEQUENCE {
                 #   version        INTEGER { ecPrivkeyVer1(1) } (ecPrivkeyVer1),
                 #   privateKey     OCTET STRING,
                 #   parameters [0] ECParameters {{ NamedCurve }} OPTIONAL,
                 #   publicKey  [1] BIT STRING OPTIONAL
                 # }

                 OpenSSL::ASN1::Sequence([
                                           OpenSSL::ASN1::Integer(1),
                                           OpenSSL::ASN1::OctetString(OpenSSL::BN.new(decode_octets(jwk_d), 2).to_s(2)),
                                           OpenSSL::ASN1::ObjectId(curve, 0, :EXPLICIT),
                                           OpenSSL::ASN1::BitString(point.to_octet_string(:uncompressed), 1, :EXPLICIT)
                                         ])
               else
                 OpenSSL::ASN1::Sequence([
                                           OpenSSL::ASN1::Sequence([OpenSSL::ASN1::ObjectId('id-ecPublicKey'), OpenSSL::ASN1::ObjectId(curve)]),
                                           OpenSSL::ASN1::BitString(point.to_octet_string(:uncompressed))
                                         ])
               end

    OpenSSL::PKey::EC.new(sequence.to_der)
  end


# Function to create and write the signature.json for a single numbered directory
def create_signature(directory)
  book_id = File.basename(directory)
  
  # Paths to metadata.json and media.json
  metadata_file = File.join(directory, 'metadata.json')
  media_file = File.join(directory, 'media.json')

  # Return if metadata.json is not found
  unless File.exist?(metadata_file)
    puts "No metadata.json found for #{book_id}, skipping."
    return
  end

  # Read the identity data
  private_jwk = JSON.parse(File.read(File.join(IDENTITY_DIR, 'publish.private.jwk')))
  
  # Create the JWT signing key
  key = create_ec_key(private_jwk['x'], private_jwk['y'], private_jwk['d'])

  # Read the metadata.json and media.json (if available)
  metadata_content = File.read(metadata_file)
  metadata_hash = Digest::SHA1.hexdigest(metadata_content)
  media_hash = File.exist?(media_file) ? Digest::SHA1.hexdigest(File.read(media_file)) : nil

  # Create the JWT payload
  payload = {
    'iss' => 'Oldpedia by the Knowledge Standards Foundation (KSF)',
    'address' => 'E-mail: info@encyclosphere.org, PO Box 31, Canal Winchester, OH 43110, USA',
    'iat' => Time.now.to_i,
    'metadata' => metadata_hash,
    'media' => media_hash
  }

  # JWT header
  header = {
    typ: 'JWT',
    jwk: private_jwk.except('d', 'alg', 'kid')
  }

  # Generate the JWT token
  token = JWT.encode(payload, key, 'ES384', header)

  # Prepare the signature.json content
  signature = {
    "identityName" => "Oldpedia by the Knowledge Standards Foundation (KSF)",
    "identityAddress" => "E-mail: info@encyclosphere.org, PO Box 31, Canal Winchester, OH 43110, USA",
    "psqrKid" => "did:psqr:oldpedia.org#publish",
    "webKid" => "did:web:did.dara.global:oldpedia#publish",
    "token" => token,
    "alg" => "ES384",
    "updated" => Time.now.utc.strftime("%Y-%m-%dT%H:%M:%S.%6N")
  }

  # Write the signature.json file
  signature_file = File.join(directory, 'signature.json')
  File.open(signature_file, 'w') do |file|
    file.write(JSON.pretty_generate(signature))
  end

  puts "Generated signature.json in #{directory}"
end

# Function to process all numbered directories and generate signature.json
def process_directories(base_dir)
  counter = 0
  error_log = File.open('error_log.txt', 'w')

  Dir.glob("#{base_dir}/*/").sort.each do |directory|
    begin
      create_signature(directory)
      counter += 1
      print "." if (counter % 100).zero?  # Print "." every 100 directories processed
    rescue StandardError => e
      # Log errors to both the console and the error_log file
      puts "Error processing directory #{directory}: #{e.message}"
      error_log.puts "Error processing directory #{directory}: #{e.message}"
    end
  end
  
  error_log.close
  puts "\nSignature creation completed."
end

# Start processing directories
process_directories(BASE_DIR)
