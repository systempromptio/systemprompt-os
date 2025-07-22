#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <string.h>
#include <termios.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s /dev/pts/X \"text to send\"\n", argv[0]);
        return 1;
    }
    
    int fd = open(argv[1], O_RDWR);
    if (fd < 0) {
        perror("Failed to open terminal");
        return 1;
    }
    
    // Get current terminal settings
    struct termios old_tio, new_tio;
    tcgetattr(fd, &old_tio);
    
    char *text = argv[2];
    for (int i = 0; i < strlen(text); i++) {
        if (ioctl(fd, TIOCSTI, &text[i]) < 0) {
            perror("Failed to send character");
            close(fd);
            return 1;
        }
    }
    
    // Send just carriage return (CR) without line feed
    char cr = 13;  // ASCII 13 is CR
    if (ioctl(fd, TIOCSTI, &cr) < 0) {
        perror("Failed to send Enter key");
        close(fd);
        return 1;
    }
    
    close(fd);
    return 0;
}