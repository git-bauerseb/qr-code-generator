// Utility class for functions frequently used during the generation of an QR code.
class QRCodeUtility {

    /*
        Convert a number in base-10 to a string representing this
        number in base-2.
    */

    // Convert a number in base-10 to a string that represents this number in binary.
    static decimalToBinary(dec) {
        return (dec >>> 0).toString(2);
    }

    // Convert a string into an array of bytes
    static stringToBytes(str) {
        let bytes = [];

        for (let i = 0; i < str.length; i += 8) {
            let substr = str.substring(i, i + 8);
            bytes.push(parseInt(substr, 2));
        }

        return bytes;
    }

    // Convert an array of bytes into a string and additionally convert bytes to binary and
    // pad to the left.
    static bytesToStr(bytes) {
        let str = '';
        bytes.forEach(b => {
            str += this.decimalToBinary(b).padStart(8, '0');
        });
        return str;
    }
}

// Class to look up constants used in the generation of QR codes.
class QRCodeConstants {

    // Characters allowed in QR codes that use numeric encoding
    static Numeric = "0123456789";

    // Characters allowed in QR codes that use the alphanumeric encoding
    static Alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

    // Maximum number of characters allowed in a specific version
    // for a specific error correction level
    static CapacityLookup = {
        'numeric': 41,
        'alpha': 25
    };

    // Size of number (in bits) that indicates how many characters are used
    // in encoding
    static CharacterCountIndicatorSize = {
        'numeric' : 10,
        'alphanum' : 9
    };

    // Total number of codewords used depending on version and error correction
    // level. To get number of bits, multiply by 8.
    static TotalCodewords = {
        'L': 19
    };

    // Bit-pattern specific for the mode
    static ModeIndicator = {
        'numeric': '0001',
        'alphanum': '0010'
    };

    // Byte pattern used to fill in the remaining space
    static Pattern = "1110110000010001";

    // Function used for the pattern in the XORing phase
    static MASK_PATTERNS = {
        '0': (row, col) => { return (row + col) % 2 == 0; },
        '1': (row, col) => { return (col % 2) == 0; },
        '2': (row, col) => { return (row % 3) == 0; },
        '3': (row, col) => { return (row + col) % 3 == 0; },
        '4': (row, col) => { return (Math.floor(col / 2) + Math.floor(row / 3)) % 2 == 0; },
        '5': (row, col) => { return ((row * col) % 2) + ((row * col) % 3) == 0; },
        '6': (row, col) => { return (((row * col) % 2) + ((row * col) % 3)) % 2 == 0; },
        '7': (row, col) => { return (((row + col) % 2) + ((row * col) % 3)) % 2 == 0; },
    };

    static FormatString = [
        '111011111000100',  // Mask Pattern 0
        '111001011110011',  // Mask pattern 1       
        '111110110101010',  // Mask pattern 2
        '111100010011101',  // Mask pattern 3
        '110011000101111',  // Mask pattern 4
        '110001100011000',  // Mask pattern 5
        '110110001000001',  // Mask pattern 6
        '110100101110110',  // Mask pattern 7
    ];
}

// Class for generating QR codes.
class QRCodeGenerator {

    constructor(data) {
        this.data = data;
    }

    encode() {
        this.rsCode = new ReedSolomonCode();
        this.mode = this.determineMode();

        let charIndicator = this.getCharacterCountIndicator();
        let dataEncoded = null;
        
        switch (this.mode) {
            case 'numeric' : dataEncoded = this.encodeNumeric(); break;
            case 'alphanum' : dataEncoded = this.encodeAlpha(); break; 
        }

        let composed = QRCodeConstants.ModeIndicator[this.mode] + charIndicator + dataEncoded;
        let capacity = this.getCapacity();

        // Add up to four terminator zeros
        let zerosToAdd = Math.min(4, Math.max(0,capacity - composed.length));
        composed = composed.padEnd(composed.length + zerosToAdd, '0');

        // If string is still too short, add 0s to get length that is a multiple of 8
        let padZeros = (8 - (composed.length % 8));

        if (padZeros + composed.length <= capacity) {
            composed = composed.padEnd(composed.length + padZeros, '0');
        }

        composed = this.addBytePadding(composed, capacity);

        console.log(composed);


        // Split binary string into bytes for error correction
        let bytes = QRCodeUtility.stringToBytes(composed);

        // Append error correction bytes to the message
        let bytesExtended = this.rsCode.rs_encode_msg(bytes, 7);
        let pattern = QRCodeUtility.bytesToStr(bytesExtended);

        return pattern;
    }


    // Determines the mode in which the QR encodes it's data.
    // There are four possibilities:
    //  i)      Numeric -       [0-9]
    //  ii)     Alphanumeric -  [0-9][A-Z] and extra characters BUT
    //                          no lowercase letters
    //  iii)    Bytes        -  General
    //  iv)     Kanji        -  Japanese letters

    //  In this implementation, only numeric and alphanumeric encodings
    //  are supported.
    determineMode() {
        let data = this.data;
        
        let alphanum = false;
        let numeric = true;
    
        for (let i = 0; i < data.length; i++) {
            // Check if all characters are numeric
            numeric &= QRCodeConstants.Numeric.indexOf(data[i]) >= 0;
            alphanum = QRCodeConstants.Alphanumeric.indexOf(data[i]) >= 0;

            if (!numeric) {
                break;
            }
        }
    
        return numeric ? "numeric" : "alphanum";
    }


    // Returns a binary number that indicates how many characters are encoded.
    // The binary number is padded to a fixed width which depends on the version
    // and the mode used for encoding.
    getCharacterCountIndicator() {
        let len = this.data.length;
        let bin = QRCodeUtility.decimalToBinary(len);
        bin = bin.padStart(QRCodeConstants.CharacterCountIndicatorSize[this.mode], '0');
        return bin;
    }


    // Encode data in numeric mode. The data is split into groups of three digits. Then
    // each group is converted into binary.
    encodeNumeric() {

        const n = this.data.length;

        let encoded = '';

        for (let i = 0; i < n - 2; i += 3) {
            let first = QRCodeConstants.Numeric.indexOf(this.data[i]);
            let second = QRCodeConstants.Numeric.indexOf(this.data[i+1]);
            let third = QRCodeConstants.Numeric.indexOf(this.data[i+2]);
            let num =  first * 100 + second * 10 + third;
            
            let binary = QRCodeUtility.decimalToBinary(num); 

            encoded += binary.padStart(10, '0');
        }

        switch (n % 3) {
            // Nothing to do as we processed data in groups of three
            case 0: break;
            // One character remaining
            case 1: {
                    let num = QRCodeConstants.Numeric.indexOf(this.data[n-1]);
                    encoded += QRCodeUtility.decimalToBinary(num).padStart(4, '0');
                }
                break;
            // Two characters remaining
            case 2: {
                    let first = QRCodeConstants.Numeric.indexOf(this.data[n-2]);
                    let second = QRCodeConstants.Numeric.indexOf(this.data[n-1]);
                    let num = first * 10 + second;
                    encoded += QRCodeUtility.decimalToBinary(num).padStart(7, '0');
                }
                break;
        }

        return encoded;
    }

    // Encoding when using alphanumeric mode. The data is split into pairs of characters
    // then compute numeric value in the form of
    //      FIRST_CHAR + 45 * SECOND_CHAR
    encodeAlpha() {
        let encoded = '';
    
        for (let i = 0; i < this.data.length - 1; i += 2) {
    
            let firstVal = QRCodeConstants.Alphanumeric.indexOf(this.data[i]);
            let secondVal = QRCodeConstants.Alphanumeric.indexOf(this.data[i + 1]);
            let binary = QRCodeUtility.decimalToBinary(firstVal * 45 + secondVal);

            encoded += binary.padStart(11, '0');
        }
    
        // If an odd number of characters are in the data
        // then append encoding of final character as 6-bit number
        if (this.data.length % 2 == 1) {
            encoded += QRCodeUtility.decimalToBinary(QRCodeConstants.Alphanumeric.indexOf(this.data[this.data.length - 1]))
                .padStart(6, '0');
        }
    
        return encoded;
    }

    
    // Computes the capacity for the QR code. As we only have error correction level L
    // and version 1 support, the capacity is always 19 * 8 = 152 bit.
    getCapacity() {
        return 19 * 8;
    }


    // Add byte pattern to the end of the string until it reaches the required length.
    addBytePadding(str, capacity) {

        let idx = 0;

        while (str.length != capacity) {
            str += QRCodeConstants.Pattern[idx % QRCodeConstants.Pattern.length];
            idx++;
        }

        return str;
    }
}


/*************************************
 * DEBUG CODE
 */

/*
const svg_group_outline = document.getElementById('penalty_group');
 
function addPenaltyCell(x, y) {
    let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', `${100 / 21}%`);
    rect.setAttribute('height', `${100 / 21}%`);
    rect.setAttribute('x', `${x * 100 / 21}%`);
    rect.setAttribute('y', `${y * 100 / 21}%`);
    rect.setAttribute('fill', `rgba(1,1,1,0)`);

    svg_group_outline.appendChild(rect);
}
 */
 /**********************************************
  * END DEBUG CODE
  */


// Class for calculating QR codes where the data part is fixed but different masks
// are applied and evaluated
class QRCodeEvaluation {

    constructor(binData) {
        this.binData = binData;

        this.FINIAL_WHITE = 2;         // For writing white cells that cannot be overdrawin
        this.FINAL_BLACK = 3;         // For black


        // Buffer contains the QR code computed according to the current pattern
        this.bufferQR = [];


        // Best buffer contains the QR code with the least penalty
        this.bestQR = [];

        for (let y = 0; y < 21; y++) {
            this.bufferQR.push([]);
            this.bestQR.push([]);

            for (let x = 0; x < 21; x++) {
                this.bufferQR[y][x] = 0;
                this.bestQR[y][x] = 0;
            }
        }
    }

    isWhite(value) {
        return (value == 0) || (value == this.FINIAL_WHITE);
    }

    isBlack(value) {
        return (value == 1) || (value == this.FINAL_BLACK);
    }

    areSameColor(value1, value2) {
        return (this.isWhite(value1) && this.isWhite(value2))
            || (this.isBlack(value1) && this.isBlack(value2));
    }

    // Fill a specific cell in the buffer. If filled is 1 the cell should get the color BLACK
    // else it is white. The reserved argument indicates if this cell is reserved, i.e. it cannot
    // be overdrawn in a later draw. This there are fixed parts in the QR code (e.g. finder patterns)
    // that cannot be used for drawing data. 
    drawCell(buffer, x, y, filled, reserved) {
        if (reserved) {
            buffer[y][x] = filled ? this.FINAL_BLACK : this.FINIAL_WHITE;
        } else if (filled) {
            buffer[y][x] = 1;
        }
    }

    // Draw the fixed pattern
    drawFixedPattern(buffer, reserved) {
        // Draw horizontal finder pattern
        for (let x = 0; x < 21; x++) {
            this.drawCell(buffer, x, 6, x % 2 == 0, reserved);
        }
    
        // Draw vertical finder pattern
        for (let y = 0; y < 21; y++) {
            this.drawCell(buffer, 6, y, y % 2 == 0, reserved);
        }
    }

    drawYLine(buffer, x, ystart, yend, filled, reserved) {
        for (let i = ystart; i < yend; i++) {
            this.drawCell(buffer, x, i, filled, reserved);
        }
    }
    
    drawXLine(buffer, y, xStart, xEnd, filled, reserved) {
        for (let i = xStart; i < xEnd; i++) {
            this.drawCell(buffer, i, y, filled, reserved);
        }
    }

    // Draw the finder pattern
    drawFinderPatterns(buffer, reserved) {
        // Draw left-upper pattern
        this.drawXLine(buffer, 0, 0, 6, true, reserved);
        this.drawXLine(buffer, 6, 0, 7, true, reserved);
        this.drawYLine(buffer, 0, 0, 6, true, reserved);
        this.drawYLine(buffer, 6, 0, 6, true, reserved);
    
        for (let i = 1; i < 6; i++) {
            this.drawXLine(buffer, i, 1, 6, false, reserved);
        }
    
        this.drawXLine(buffer, 2, 2, 5, true, reserved);
        this.drawXLine(buffer, 3, 2, 5, true, reserved);
        this.drawXLine(buffer, 4, 2, 5, true, reserved);
    
        this.drawYLine(buffer, 7, 0, 8, false, reserved);
        this.drawXLine(buffer, 7, 0, 8, false, reserved);
    
        // Draw right-upper pattern
        this.drawXLine(buffer, 0, 20 - 6, 20, true, reserved);
        this.drawXLine(buffer, 6, 20 - 6, 21, true, reserved);
        this.drawYLine(buffer, 20 - 6, 0, 6, true, reserved);
        this.drawYLine(buffer, 20, 0, 6, true, reserved);
    
        for (let i = 1; i < 6; i++) {
            this.drawXLine(buffer, i, 1 + (20 - 6), 20, false, reserved);
        }
    
        this.drawXLine(buffer, 2, 2 + (20 - 6), 19, true, reserved);
        this.drawXLine(buffer, 3, 2 + (20 - 6), 19, true, reserved);
        this.drawXLine(buffer, 4, 2 + (20 - 6), 19, true, reserved);
    
        this.drawYLine(buffer, 13, 0, 8, false, reserved);
        this.drawXLine(buffer, 7, 13, 21, false, reserved);
    
        // Draw left-lower pattern
        this.drawXLine(buffer, 20, 0, 7, true, reserved);
        this.drawXLine(buffer, 20 - 6, 0, 6, true, reserved);
        this.drawYLine(buffer, 0, 20 - 6, 20, true, reserved);
        this.drawYLine(buffer, 6, 20 - 6, 20, true, reserved);
    
        for (let i = 1; i < 6; i++) {
            this.drawXLine(buffer, 14 + i, 1, 6, false, reserved);
        }
    
        this.drawXLine(buffer, 16, 2, 5, true, reserved);
        this.drawXLine(buffer, 17, 2, 5, true, reserved);
        this.drawXLine(buffer, 18, 2, 5, true, reserved);
    
    
        this.drawXLine(buffer, 20 - 6 - 1, 0, 8, false, reserved);
        this.drawYLine(buffer, 7, 14, 21, false, reserved);
        this.drawYLine(buffer, 8, 13, 21, false, reserved);
    }

    // Draw the format string
    drawFormatPatterns(buffer, reserved, pattern) {
        for (let i = 0; i < 6; i++) {
            this.drawCell(buffer, i, 8, pattern[i] === '1', reserved);
        }
    
        this.drawCell(buffer, 7, 8, pattern[6] === '1', reserved);
        this.drawCell(buffer, 8, 8, pattern[7] === '1', reserved);
        this.drawCell(buffer, 8, 7, pattern[8] === '1', reserved);
    
        for (let y = 0; y < 6; y++) {
            this.drawCell(buffer, 8, y, pattern[14 - y] === '1', reserved);
        }
    
        for (let x = 0; x < 8; x++) {
            this.drawCell(buffer, x + 13, 8, pattern[x + 7] === '1', reserved);
        }
    
        for (let y = 0; y < 7; y++) {
            this.drawCell(buffer, 8, 20 - y, pattern[y] === '1', reserved);
        }
    
        this.drawCell(buffer, 8, 20 - 7, true, reserved);
    }

    drawData(buffer, pattern) {
        // If true, iterating upwards
        // If false, iterating downwards
        let direction = true;
    
        // Index in the bitstring
        let idx = 0;
        
        /*
            Computes:
                (true, true)    -> false
                (true, false)   -> true
                (false, true)   -> true
                (false, false)  -> false
        */
        let logical_xor = (a, b) => {
            return a == b ? false : true;
        }
    
        for (let x = 20; x > 0;) {
            if (x === 6) {
                x--;
                continue;
            }
    
            // Iterate upwards
            for (let y = direction ? 20 : 0; direction ? y >= 0 : y <= 20; direction ? y-- : y++) {
                if (buffer[x][y] !== this.FINIAL_WHITE && buffer[x][y] !== this.FINAL_BLACK) {
                    this.drawCell(buffer, x, y, logical_xor(pattern(x,y), this.binData[idx]), false);
                    idx++;
                }
    
                if (buffer[x - 1][y] !== this.FINIAL_WHITE && buffer[x - 1][y] !== this.FINAL_BLACK) {
                    this.drawCell(buffer, x - 1, y, logical_xor(pattern(x-1,y), this.binData[idx]), false);
                    idx++;
                }
            }
    
            direction = !direction;
            x -= 2;
        }
    }

    // Draw a QR code in the buffer with the specified XOR mask as it would
    // be drawn in the final output. Because the QR code is evaluated by using different
    // penalty terms, a direct draw call to the buffer is not done.
    drawQRCode(buffer, patternIdx) {
        this.drawFixedPattern(buffer, true);
        this.drawFinderPatterns(buffer, true);
        this.drawFormatPatterns(buffer, true, QRCodeConstants.FormatString[patternIdx]);
        this.drawData(buffer, QRCodeConstants.MASK_PATTERNS[patternIdx],7);
        // this.drawFormatPatterns(buffer, true, QRCodeConstants.FormatString[patternIdx+1]);
    }

    // Calculate horizontal and vertical, linear penalty terms.
    calculateLinearPenalty(buffer) {

        const n = buffer.length;

        let penalty = 0;
    
        // Row
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
    
                let numSame = 0;
                let currentCol = buffer[y][x];
                while (x < buffer.length && this.areSameColor(buffer[y][x], currentCol)) {
                    numSame++;
                    x++;
                }
    
                if (numSame >= 5) {
                    penalty += 3 + (numSame - 5);
                }
    
                x--;
            }
        }
    
        // Column
        for (let x = 0; x < n; x++) {
            for (let y = 0; y < n; y++) {
                let numSame = 0;
                let currentCol = buffer[y][x];
                while (y < buffer.length && this.areSameColor(buffer[y][x],currentCol)) {
                    numSame++;
                    y++;
                }

                if (numSame >= 5) {
                    penalty += 3 + (numSame - 5);
                }

                y--;
            }
        }
    
        return penalty;
    }
    
    calculateBoxPenalty(buffer) {
    
        let penalty = 0;
    
        for (let x = 0; x < buffer.length - 1; x++) {
            for (let y = 0; y < buffer.length - 1; y++) {
                if (this.areSameColor(buffer[x][y],buffer[x+1][y])
                    && this.areSameColor(buffer[x+1][y],buffer[x][y+1])
                    && this.areSameColor(buffer[x+1][y],buffer[x+1][y+1])) {
                    penalty += 3;
                }
            }
        }
    
        return penalty;
    }
    
    calculateFinderPenalty(buffer) {
        let penalty = 0;
        const pattern = [1,0,1,1,1,0,1];
        
        // Horizontal
        for (let y = 0; y < buffer.length; y++) {
            for (let x = 0; x < buffer.length; x++) {
    
                let xStart = x;
                let xEnd = xStart;
                let fIdx = 0;
    
                while (xEnd < buffer.length && fIdx < pattern.length 
                    && this.areSameColor(buffer[y][xEnd],pattern[fIdx])) {
                    xEnd++;
                    fIdx++;
                }
    
                // Found pattern
                // Now, four white cells need to be either on the left side or right side
                if (fIdx === 7) {
    
                    let leftFound = false;
                    let rightFound = false;
    
                    // Check if pattern is at beginning or end
                    // If so, then immediately add penalty
                    if (xStart === 0) {
                        leftFound = true;
                        penalty += 40;
                    } else if (xEnd === buffer.length) {
                        rightFound = true;
                        penalty += 40;

                    }
    
    
    
                    if (!leftFound) {
                        let foundWhite = true;
    
                        for (let t = xStart - 1; t >= Math.max(0, xStart - 4); t--) {
                            if (this.isBlack(buffer[y][t])) {
                                foundWhite = false;
                                break;
                            }
                        }
    
                        if (foundWhite) {
                            penalty += 40;
                        }
                    }
    
                    if (!rightFound) {
                        let foundWhite = true;
    
                        for (let t = xEnd; t < Math.min(buffer.length, xEnd + 4); t++) {
                            if (this.isBlack(buffer[y][t])) {
                                foundWhite = false;
                                break;
                            }
                        }
    
                        if (foundWhite) {
                            penalty += 40;
                        }
                    }
                }
            }
        }
        
    
        // Vertical
        for (let x = 0; x < buffer.length; x++) {
            for (let y = 0; y < buffer.length; y++) {
    
    
                let yStart = y;
                let yEnd = yStart;
                let fIdx = 0;
    
                while (yEnd < buffer.length && fIdx < pattern.length
                        && this.areSameColor(buffer[yEnd][x], pattern[fIdx])) {
                    yEnd++;
                    fIdx++;
                }
    
                if (fIdx === 7) {
    
                    let foundUp = false;
                    let foundDown = false;
    
                    // Check if pattern is at beginning or end
                    // If so, then immediately add penalty
                    if (yStart === 0) {
                        foundUp = true;
                        penalty += 40;
                    } else if (yEnd === buffer.length) {
                        foundDown = true;
                        penalty += 40;
                    }
    
    
    
                    if (!foundUp) {
                        let foundWhite = true;

                        for (let t = yStart - 1; t >= Math.max(0, yStart - 4); t--) {
                            if (this.isBlack(buffer[t][x])) {
                                foundWhite = false;
                                break;
                            }
                        }
    
                        if (foundWhite) {                    
                            penalty += 40;
                        }
                    }
    
                    if (!foundDown) {

                        let foundWhite = true;
    
                        for (let t = yEnd; t < Math.min(buffer.length, yEnd + 4); t++) {
                            if (this.isBlack(buffer[t][x])) {
                                foundWhite = false;
                                break;
                            }
                        }
    
                        if (foundWhite) {
                            penalty += 40;
                        }
                    }
                }
            }
        }
    
        return penalty;
    }
    
    calculateFracPenalty(buffer) {
        
        let black = 0;
        let white = 0;
        
        for (let x = 0; x < buffer.length; x++) {
            for (let y = 0; y < buffer.length; y++) {
                white += (this.isWhite(buffer[x][y])) ? 1 : 0;
                black += (this.isBlack(buffer[x][y])) ? 1 : 0;
            }
        }
    
        let fracBlack = Math.round((black / (black + white)) * 100);
    
        let lower = fracBlack - (fracBlack % 5);
        let upper = lower + 5;
    
        lower = Math.abs(lower - 50);
        upper = Math.abs(upper - 50);
    
        lower /= 5;
        upper /= 5;
    
        return 10 * Math.min(lower, upper);
    }
    
    calculatePenalty(buffer) {
        let linearPenalty = this.calculateLinearPenalty(buffer);
        let boxPenalty = this.calculateBoxPenalty(buffer);
        let finderPenalty = this.calculateFinderPenalty(buffer);
        let fracPenalty = this.calculateFracPenalty(buffer);

        console.log(`  RunP: ${linearPenalty}`);
        console.log(`  BoxP: ${boxPenalty}`);
        console.log(`  FindP: ${finderPenalty}`);
        console.log(`  FracP: ${fracPenalty}`);
        
    
        return linearPenalty + boxPenalty + finderPenalty + fracPenalty;
    }

    getQRWithBestMask() {

        let minPenalty = Number.MAX_VALUE;
        let bestPattern = -1;

        for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
            this.drawQRCode(this.bufferQR, maskIdx);
            let penalty = this.calculatePenalty(this.bufferQR);

            console.log(`Pattern ${maskIdx+1} == Penalty: ${penalty}`);

            if (penalty < minPenalty) {
                minPenalty = penalty;
                bestPattern = maskIdx;

                let swap = this.bufferQR;
                this.bufferQR = this.bestQR;
                this.bestQR = swap;
            }

            for (let y = 0; y < 21; y++) {
                for (let x = 0; x < 21; x++) {
                    this.bufferQR[y][x] = 0;
                }
            }
        }


        console.log(`Best Pattern: ${bestPattern+1}\n  PENALTY: ${minPenalty}`);

        // Convert bestQR to boolean values
        for (let y = 0; y < 21; y++) {
            for (let x = 0; x < 21; x++) {
                this.bestQR[y][x] = this.isBlack(this.bestQR[y][x]);
            }
        }

        return this.bestQR;
    }

}


const svg = document.getElementById('qrcode_svg');
let svgRects = [];

function setupQRCodeDrawing() {
    for (let y = 0; y < 21; y++) {
        svgRects.push([]);

        for (let x = 0; x < 21; x++) {

            let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', `${100 / 21}%`);
            rect.setAttribute('height', `${100 / 21}%`);
            rect.setAttribute('x', `${x * 100 / 21}%`);
            rect.setAttribute('y', `${y * 100 / 21}%`);
            rect.setAttribute('fill', 'black');
            svg.insertBefore(rect, svg.firstChild);

            svgRects[y][x] = rect;
        }
    }
}

function setCell(x, y, filled) {
    if (filled) {
        svgRects[y][x].setAttribute('fill', 'black');
    } else {
        svgRects[y][x].setAttribute('fill', 'white');
    }
}

setupQRCodeDrawing();

// 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:

let generator = new QRCodeGenerator('HELLO WORLD+-/123$%');
let data = generator.encode();


let evaluation = new QRCodeEvaluation(data);

let buffer = evaluation.getQRWithBestMask();

for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
        setCell(x,y,buffer[y][x]);
    }
}
