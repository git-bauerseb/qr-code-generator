## Error Correction

Practically speaking, QR codes would be useless if they wouldn't rely on some mechanism to correct errors.

### Finite fields

In traditional arithmetic, one is used to the properties of real numbers such as:
    
    - a + 0 = a
    - a + (-a) = 0
    - 1 * a = a
    - 0 * a = 0
    - a * inv(a) = 1
    - a * (b + c) = a * b + a * c
    - a + (b + c) = (a + b) + c
    - ...

In mathematics, one calls a structure with these properties a field. Examples of fields include the real numbers, rational numbers and complex numbers. Integers on the other hand are not fields, because for example 5 / 4 = 1.25 is not an integer. But, and this is the important part, one can turn (parts of) the integers into a field by using the remainder function. What you may know from school is that if you take the remainder (the operation is called `mod` in the following) of a number **a** with respect to some other number **p**, you always end up with something that is smaller than **p**. Consider for example:

```
a = 5
p = 3
a mod p = 5 mod 3 = 2
```

As you can prove in mathematics, if you choose a remainder that is a prime number **p** (2,3,5,7,11,..) then the numbers **0, 1, ..., p-1** together with multiplication and addition form a field, just like the reals. Such fields are named **finite fields** or **galois fields (GF)**, named after their inventor ([who tragically died at the age of 20](https://en.wikipedia.org/wiki/%C3%89variste_Galois)). GF(5) for example consists of the numbers `0,1,2,3,4` and one can add and multiply in the following way:

```
in GF(5):
    4 * 3 mod 5 = 12 mod 5 = 2
        => 4 * 3 = 2

    The inverse of 4 is 4 itself, as
        4 * 4 mod 5 = 16 mod 5 = 1
```


 A very interesting field is now GF(2) because it consists of only two numbers `0,1` that can be represented with a single bit.