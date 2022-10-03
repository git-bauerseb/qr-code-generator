// Class for appending to a message error correction bytes
// according to the Reed-Solomon scheme
class ReedSolomonCode {
    constructor() {
        this.gf_exp_lookup = [];
        this.gf_exp_lookup[255] = 1;

        this.gf_log_lookup = [];
        this.gf_log_lookup[255] = 1;

        this.init_gf_tables_(0x11d);
    }

    // Arithmetic in finite fields
    gf_add(x, y) {return x ^ y;}
    gf_sub(x, y) {return x ^ y;}
    
    gf_mul(x, y) {
        if (x === 0 || y === 0) {
            return 0;
        }

        return this.gf_exp_lookup[(this.gf_log_lookup[x] + this.gf_log_lookup[y]) % 255];
    }

    gf_div(x, y) {
        if (y === 0) {
            console.log('Division by zero.');
        }

        if (x === 0) {
            return 0;
        }

        return this.gf_exp_lookup[(this.gf_log_lookup[x] + 255 - this.gf_log_lookup[y]) % 255];
    }

    gf_pow(x, e) {
        return this.gf_exp_lookup[(this.gf_log_lookup[x] * e) % 255];
    }

    gf_inv(x) {

        if (x === 0) {
            console.log('0 has no inverse.');
        }

        return this.gf_exp_lookup[255 - this.gf_log_lookup[x]];
    }

    // Operations on polynomials (lists of finite field elements)
    // Multiply polynomial by scalar
    gf_poly_scalar_mul(poly, x) {
        for (let i = 0; i < poly.length; i++) {
            r[i] = this.gf_mul(p[i], x);
        }
    }

    // Add two polynomials
    gf_poly_add(p, q) {
        for (let i = 0; i < p.length; i++) {
            r[i + Math.max(p.length, q.length) - p.length] = p[i];
        }

        for (let i = 0; i < q.length; i++) {
            r[i + Math.max(p.length, q.length) - q.length] ^= q[i];
        }

        return r;
    }

    gf_poly_mul(p, q) {
        let r = [];

        for (let j = 0; j < q.length; j++) {
            for (let i = 0; i < p.length; i++) {
                r[i + j] ^= this.gf_mul(p[i], q[j]);
            }
        }

        return r;
    }

    // Evaluate a polynomial at a given position using
    // Horner's scheme.
    gf_poly_eval(poly, x) {
        let y = poly[0];

        for (let i = 1; i < poly.length; i++) {
            y = this.gf_mul(y, x) ^ poly[i];
        }

        return y;
    }

    // Compute generator polynomial for a given number of symbols. 
    rs_generator_poly(num_sym) {
        let g = [];
        g[0] = 1;

        for (let i = 0; i < num_sym; i++) {
            g = this.gf_poly_mul(g, [1, this.gf_pow(2, i)]);
        }

        return g;
    }

    
    // Performs a polynomial division of the two specified polynomials.
    // Order of polynomials is expected from biggest to lowest degree, e.g.

    // 3x^3 + 8x^2 + 7x + 1 -> [3,8,7,1] not [1,7,8,3]
    gf_poly_div(dividend, divisor) {

        let out = [];

        for (let i = 0; i < dividend.length; i++) {
            out[i] = dividend[i];
        }

        for (let i = 0; i < dividend.length - (divisor.length - 1); i++) {
            let coef = out[i];

            if (coef != 0) {
                for (let j = 1; j < divisor.length; j++) {
                    if (divisor[j] != 0) {
                        out[i + j] ^= this.gf_mul(divisor[j], coef);
                    }
                }
            }
        }

        let separator = -(divisor.length - 1);
        return {
            'quotient': out.slice(0, separator),
            'remainder': out.slice(separator, out.length)
        };
    }

    rs_encode_msg(msg_in, nsym) {
        let gen = this.rs_generator_poly(nsym);

        let pol = [];

        for (let i = 0; i < msg_in.length; i++) {
            pol[i] = msg_in[i];
        }

        for (let i = msg_in.length; i < msg_in.length + gen.length - 1; i++) {
            pol[i] = 0;
        }

        let divResult = this.gf_poly_div(pol, gen);

        msg_in.push(...divResult['remainder']);

        return msg_in;
    }

    
    // Computes exp/log table for GF(2^8) given a prime polynomial.
    init_gf_tables_(p_poly) {
        let x = 1;

        for (let i = 0; i < 256; i++) {
            this.gf_exp_lookup[i] = x;
            this.gf_log_lookup[x] = i;
    
            x <<= 1;
            if (x & 0x100) {
                x ^= p_poly;
            }
        }
    }
}