# About

This repository contains a sort of tutorial on how to create a simple QR code generator in Javascript.


## Tutorial

QR codes are ubiquitous and can be found nearly everywhere on physical items to websites and apps. While there are many libraries that make encoding/decoding very simple, there are, is far as I know, no good tutorials that show how to write a QR code generator from scratch. This now is exactly the goal of this repository: To just use some Javascript and an HTML svg element to produce QR codes that you can scan and decode with your phone. So let's jump into it.


!['Hello World' QR code](img/qr_code_header.png)


## General

First, create a new html file **qrcode.html** that looks like this:

```html
<!DOCTYPE html>
<html>
    <head></head>
    <body>
        <svg width="256" height="256" id="qrcode_svg">
        </svg>

        <script src="../js/error_correction.js"></script>
        <script src="../js/qr_code.js"></script>
    </body>
</html>
```

and two Javascript files **qr_code.js, error_correction.js**. The HTML part is already done and contains only a simple svg element where we will draw our QR code.

## Setup

Before actually coding, it's a good idea to structure our project into some classes in order to be able to extend our implementation later if we want to. For this, I defined three classes **QRCodeUtility, QRCodeConstants, QRCodeGenerator** in **qr_code.js** which will contain utility functions, constants used in the encoding process and an actual generator class.

The **error_correction.js** file only contains one class **ReedSolomonCode** that deals with adding error correction bits to our messages.



## Data Analysis

First, we need to decide what we actually want to encode, so let's create a constructor for our generator:

```js
class QRCodeGenerator {
    constructor(data) {
        this.data = data;
    }
}
```

The QR code specification has different encoding modes, depending on the use case of the code. In general, there are four different modes:

 - Numeric (Numbers 0 - 9)
 - Alphanumeric (Numbers 0 - 9; Uppercase letters; Symbols $,%,*,+,-,.,/)
 - Kanji
 - Byte

In order to keep this tutorial short, I decided to only support alphanumeric mode which means that we **cannot encode lowercase characters**. This limitation can be easily lifted but requires some boring case work so I decided against it.

Define the different characters that can be used in our constant class and a lookup:

```js
class QRCodeConstants {

    static Numeric = "0123456789";
    static Alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
}
```

Because the numeric mode is a subset of the alphanumeric, we need a function that tells us to which mode our data string belongs to. The code for this is:

```js
// ... class QRCodeGenerator
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
```

It just loops over all characters in our data string and checks to which class it belongs. By Anding the values in the numeric variable we make sure that we are only
in the numeric mode if all characters are numeric. Else, we immediately can tell that we will need alphanumeric encoding.

## Data Encoding

After we determined the encoding mode we need to incorporate an error correction level. Depending on the use case for the generated QR code, different error correction capabilities might be necessary (physically printed QR codes that might get distorted need a higher error correction level than a QR code generated on a computer screen). The standard defines four different levels:

 - L: recover up to 7% of data
 - M: recover up to 15% of data
 - Q: recover up to 25% of data
 - H: recover up to 30% of data

Once again, as in the encoding part, I decided to only support the level L because supporting different levels will lead again to some uninteresting case work.


After this, we need to select which version of QR code to use. The version depends on how many characters we want to encode. There are fourty different versions, where version 1 supports up to 20 characters and version 40 supports 4296 characters. I'm sorry to tell you once more, that the article restricts to a subset and only supports version 1. This means that with our QR code generator we can encode **up to 20 uppercase characters**. I hope not to disappoint you at this point as our generator is quite limited (we're basically restricted to uppercase english words). However, there's still some interesting stuff waiting for you and if you want, you can later on add different versions.


### Encoding

We won't simply encode our data and draw them on our svg element. In order for QR code readers to understand our data bits, we need to provide additional information.
There are overall four different parts of our encoded message:
 - **Mode indicator**: Indication which mode we use for encoding (numerical/alphanumeric)
    - **Character count**: The length of our data string (e.g. for 'HELLO WORLD' it would be 11)
    - **Data**: The actual data
    - **Terminator**: Trailing bits to fill the entire space of our QR code and to not leave it blank

#### Mode Indication

For the mode indicator, simply define some constants:

```js
// ... class QRCodeConstants
static ModeIndicator = {
    'numeric' : '0001',
    'alphanum' : '0010'
}
```

When we compose our message later on, we will simple look the mode up in this dictionary.

### Character count

The character count is now a binary number that depends on the mode we use. If we use numeric mode, then it is 9 bits long (possibly padded). If we use alphanumeric mode, then it is 10 bits long (of course this is only for version 1. Other versions have different lengths).

For this define the following utility function which converts a number to a binary string:

```js
// ... class QRCodeUtility
static decimalToBinary(dec) {
    return (dec >>> 0).toString(2);
}
```

and in `QRCodeGenerator` define a new function `getCharacterCountIndicator()`:

```js
// ... class QRCodeGenerator
getCharacterCountIndicator() {
    let len = this.data.length;
    let bin = QRCodeUtility.decimalToBinary(len);
    bin = bin.padStart(QRCodeConstants.CharacterCountIndicatorSize[this.mode], '0');
    return bin;
}
```

We first compute the binary number from the length of our data string and afterwards make a lookup to pad this binary binary if necessary:

```js
// ... class QRCodeConstants
static CharacterCountIndicatorSize = {
    'numeric' : 10,
    'alphanum' : 9
};
```

(For e.g. 'HELLO WORLD' we have a length of 11; 11 is 1011 in binary; because we use alphanumeric encoding, the length needs to be 9 bits, so we add 5 0's in front and get 000001011)

### Data

After that, let's encode some data! Depending on whether we use numeric or alpha mode, we use different encoding strategies.


#### Numeric mode

In numeric enecoding, we split our data into groups of three digits, convert them to a number (100 * firstDigit + 10 * secondDigit + thirdDigit) and convert them into a binary string which has a length of 10 (so we need padding if necessary). If the length of our string is not a multiple of 3, then we are left with either groups of two or a single character. If we have two characters remaining, then we need to pad our number to a length of 7, otherwise 4 characters suffice.

This is implementented as follows:

```js
// ... class QRCodeGenerator
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
```


#### Alphanumeric

In alphanumeric encoding we split our string in groups of 2. Then we convert this pair of characters to a number as follows

```
firstChar * 45 + secondChar
```

and pad the resulting binary number to have a length of 11. If our string has 1 remaining character then simply convert it to a number and pad the binary to 6 places. All of this does the following function:


```js
// ... class QRCodeGenerator
encodeAlpha() {
    let encoded = '';

    for (let i = 0; i < this.data.length - 1; i += 2) {

        let firstVal = QRCodeConstants.Alphanumeric.indexOf(data[i]);
        let secondVal = QRCodeConstants.Alphanumeric.indexOf(data[i + 1]);
        let binary = QRCodeUtility.decimalToBinary(firstVal * 45 + secondVal);

        encoded += binary.padStart(11, '0');
    }

    // If an odd number of characters are in the data
    // then append encoding of final character as 6-bit number
    if (data.length % 2 == 1) {
        encoded += QRCodeUtility.decimalToBinary(QRCodeConstants.Alphanumeric.indexOf(data[data.length - 1]))
            .padStart(6, '0');
    }

    return encoded;
}
```

### Padding

Because we can encode strings of variable length, we need to introduce padding. For this, we first need to now how many bits actually fit in the code for our choosen version and error correction level.

In our case, a version 1-L code, there can be 19 bytes and thus 19*8 bits:

```js
// ... class QRCodeGenerator
getCapacity() {
    return 19 * 8;
}
```

### Encoding Function

Now is a good place to introduce the actual encoding function:

```js
// ... class QRCodeGenerator
encode() {
    this.mode = this.determineMode();

    let charIndicator = this.getCharacterCountIndicator();
    let dataEncoded = null;
    
    switch (this.mode) {
        case 'numeric' : dataEncoded = this.encodeNumeric(); break;
        case 'alphanum' : dataEncoded = this.encodeAlpha(); break; 
    }

    let composed = QRCodeConstants.ModeIndicator[this.mode] + charIndicator + dataEncoded;
}
```

We first determine the mode here. Afterwards we get the character count (which uses `this.mode` for case distinction). Then we encode our data and finally put everything together in the string `composed`.

#### 0 padding

If our composed string is too short (less than capacity bits), then we first pad it with up to 4 zero bits:

```js
// encode() in class QRCodeGenerator
// ...
let capacity = this.getCapacity();
let zerosToAdd = Math.min(4, Math.max(0,capacity - composed.length));
composed = composed.padEnd(composed.length + zerosToAdd, '0');
```

Afterwards, if it is still too short, we add another group of 0s to get a length of our `composed` string which is a multiple of 8:

```js
// encode() in class QRCodeGenerator
// ...
let padZeros = (8 - (composed.length % 8));

if (padZeros + composed.length <= capacity) {
    composed = composed.padEnd(composed.length + padZeros, '0');
}
```

#### Byte padding

If our string is still too short, then we add a specific byte pattern. This is done, to make the scanning of the QR code easier (large areas of white cells are not ideal).

First, define the padding string in our constants class:

```js
// ... class QRCodeConstants
static Pattern = "1110110000010001";
```

and implement the padding functionalty in **QRCodeGenerator**:

```js
addBytePadding(str, capacity) {

    let idx = 0;

    while (str.length != capacity) {
        str += QRCodeConstants.Pattern[idx % QRCodeConstants.Pattern.length];
        idx++;
    }

    return str;
}
```

This appends bytes to our input string until it reaches the desired length. By using modulo, we move back to the beginning of the pattern once we reached the last character.

Once we've done this, we can finalize our implementation of our `encode` function:

```js
composed = this.addBytePadding(composed, capacity);
return composed
```

For the string

```
HELLO WORLD+-/123$%
```

our `composed` bit string is:

```
00100000100110110000101101111000110100010111001011011100010011010100010011100011110110000000000101111000101011001001100000000000111011000001000111101100
```