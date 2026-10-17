values = [18, 37,  3, 13, 10, 11, 31,  7, 17, 33,
           6, 38,  4, 14, 35, 26, 22, 39,  9, 25,
          19,  5,  2, 12, 23, 24,  1,  8, 28, 30,
          36, 16, 34, 20, 15, 29, 27, 32, 40, 21] #l#

n = len(values) #t#

# Swap the elements at indices k and l
def swap(k, l): #s#
    values[k],values[l] = values[l],values[k]

def heapify(p, q): #tv(p:2,q:3)d(p-q)#
    maximum_index = p #tv(1)#
    left_index = 2 * p + 1 #t#
    right_index = left_index + 1 #t#

    if left_index <= q and \
            values[left_index] > values[maximum_index]:
        maximum_index = left_index

    if right_index <= q and \
            values[right_index] > values[maximum_index]:
        maximum_index = right_index

    if maximum_index != p:
        swap(p, maximum_index)
        heapify(maximum_index, q)

for i in range(n // 2 - 1, -1, -1): #t#
    heapify(i, n - 1)

for i in range(n - 1, 0, -1): #t#
    swap(0, i)
    heapify(0, i - 1)
