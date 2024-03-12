**Encrypting the password file**

```bash
docker exec mosquitto mosquitto_passwd -U /mosquitto/config/passwd
```

**Add more users**

```bash
docker exec mosquitto mosquitto_passwd -b /mosquitto/config/passwd user password
```
