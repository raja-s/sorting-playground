values = [18, 37,  3, 13, 10, 11, 31,  7, 17, 33,
           6, 38,  4, 14, 35, 26, 22, 39,  9, 25,
          19,  5,  2, 12, 23, 24,  1,  8, 28, 30,
          36, 16, 34, 20, 15, 29, 27, 32, 40, 21] #l#

n = len(values) #t#

# Swap the elements at indices k and l
def swap(k, l): #s#
    values[k],values[l] = values[l],values[k]

def partition(start, end): #v(end:3)#
    i = start #tv(2)#
    for j in range(start, end): #tv(1)#
        if values[j] <= values[end]:
            swap(i, j)
            i += 1
    swap(i, end)
    return i

def quicksort(start, end): #td(start-end)#
    if start < end:
        pivot_index = partition(start, end) #tv(3)#
        quicksort(start, pivot_index - 1)
        quicksort(pivot_index + 1, end)

quicksort(0, n - 1)
