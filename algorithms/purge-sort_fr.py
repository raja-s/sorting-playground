valeurs = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

i = 0 #tv#

while i < len(valeurs) - 1:
    if valeurs[i + 1] < valeurs[i]:
        valeurs.pop(i + 1)
    else:
        i += 1
