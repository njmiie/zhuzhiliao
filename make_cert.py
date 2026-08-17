"""生成自签名证书 cert.pem / key.pem（供 http-server -S 使用）
用法：python make_cert.py [IP...]   例如 python make_cert.py 192.168.110.117
"""
import sys, datetime, ipaddress
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

ips = [a for a in sys.argv[1:]]
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'zhizhiliao-local')])
san = [x509.DNSName('localhost'), x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]
for ip in ips:
    san.append(x509.IPAddress(ipaddress.ip_address(ip)))
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder()
        .subject_name(name).issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .sign(key, hashes.SHA256()))
with open('cert.pem', 'wb') as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))
with open('key.pem', 'wb') as f:
    f.write(key.private_bytes(serialization.Encoding.PEM,
                              serialization.PrivateFormat.TraditionalOpenSSL,
                              serialization.NoEncryption()))
print('已生成 cert.pem / key.pem，SAN 包含:', 'localhost, 127.0.0.1' + (', ' + ', '.join(ips) if ips else ''))
