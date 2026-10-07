# Backup i vraćanje sajta

Ovaj repozitorij sada ima automatski backup sistem.

## Kako će se raditi buduće izmjene

Svaka promjena koju radimo ide kroz Pull Request. Prije ulaska izmjene u `main`, workflow napravi immutable Git tag koji pokazuje na tačan `main` commit koji je postojao prije izmjene.

Dodatno, svaki push na `main` automatski sačuva i `github.event.before` commit kao backup tag. Tako čak i ako se neka promjena spoji odmah, prethodno stanje ostaje označeno i lako dostupno.

Backup tagovi koriste oblik:

- `backup/pr-<broj>-<commit>` — snapshot `main` prije PR-a
- `backup/pre-main-<run>-<commit>` — snapshot neposredno prije konkretnog push-a na `main`

## Vraćanje

Najsigurnije je napraviti novu restore granu iz željenog backup taga i tek onda vratiti stanje u `main`. Nećemo brisati backup tagove.

Pravilo za naš dalji rad: **prije svake izmjene prvo napravimo snapshot, pa tek onda mijenjamo kod.** 
