FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl git sudo vim \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean

# Tạo user và cấp quyền sudo
RUN useradd -m agent && echo "agent ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# CHỈNH SỬA ĐOẠN NÀY: Tạo thư mục và gán quyền trước khi chuyển USER
RUN mkdir -p /home/agent/app && chown -R agent:agent /home/agent/app

USER agent
WORKDIR /home/agent/app

CMD ["tail", "-f", "/dev/null"]