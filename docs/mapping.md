| Physical position  | Sensor label | CD4067 channel | Baseline | Hand value |   Δ |
| ------------------ | ------------ | -------------: | -------: | ---------: | --: |
| Front-left         | F1           |              0 |     4095 |       >300 |     |
| Front-left-center  | F2           |              1 |     4095 |       >300 |     |
| Front-center-left  | F3           |              2 |     4095 |       >300 |     |
| Front-center-right | F4           |              3 |     4095 |       >300 |     |
| Front-right-center | F5           |              4 |     4095 |       >300 |     |
| Front-right-center | F6           |              5 |     4095 |       >300 |     |
| Front-right        | F7           |              6 |     4095 |       >300 |     |
| Front-rightmost    | F8           |              7 |     4095 |       >300 |     |
| Bottom-front-left  | B1           |             10 |     4095 |       >200 |     |
| Bottom-front-right | B2           |              8 |     4095 |       >200 |     |
| Bottom-rear-left   | B3           |             12 |     4095 |       >200 |     |
| Bottom-rear-right  | B4           |             13 |     4095 |       >180 |     |
| Corner-front-left  | C1           |              9 |      536 |       >200 |     |
| Corner-front-right | C2           |             15 |     1590 |       >200 |     |
| Corner-rear-left   | C3           |             11 |     4095 |       >200 |     |
| Corner-rear-right  | C4           |             14 |     4095 |       >180 |     |

The handvalue given is the value when i almost touch the corresponding sensor.
Also the below configuration is what worked:
#define MUX_S0 4
#define MUX_S1 5
#define MUX_S2 6
#define MUX_S3 17
#define MUX_SIG 1 // CD4067 SIG -> ADC (GPIO1)

The 7, 6, 5, 4, 1 configuration was wrong.
